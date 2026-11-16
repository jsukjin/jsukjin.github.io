---
title: "[Core] DirectEffect"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-15
draft: "False"
description: "[SteamAudio] Direct Effect 분석 (core module)"
---

---

# 1. Introduction

- `DirectSpoundPath` 값을 받아서 Audio buffer에 물리적 감쇠를 적용하는 effect
- `DirectSimulator` 가 값을 계산 / `DirectEffect` 가 값을 적용

```
DirectSoundPath (값)
        ↓
calculateGainAndEQ()
        ↓
applyEQ 여부 판단
        ↓
EQEffect  (주파수별 감쇠) ← AirAbsorption / FreqDependent Transmission
GainEffect (전체 감쇠)   ← DistanceAttenuation / Directivity / Occlusion
```

---
# 2. 구성 요소

``` cpp fold title:Steam Audio C++
// 어떤 효과를 적용할지 비트플래그
enum DirectEffectFlags
{
    ApplyDistanceAttenuation = 1 << 0,
    ApplyAirAbsorption       = 1 << 1,
    ApplyDirectivity         = 1 << 2,
    ApplyOcclusion           = 1 << 3,
    ApplyTransmission        = 1 << 4
};

// 투과 처리 방식
enum class TransmissionType
{
    FreqIndependent,  // gain 하나로 처리 → GainEffect
    FreqDependent     // 주파수별 처리   → EQEffect
};

// 시뮬레이션 결과값
struct DirectSoundPath
{
    float distanceAttenuation;       // 0.0 ~ 1.0
    float airAbsorption[kNumBands];  // 주파수 대역별
    float delay;                     // 전파 지연 (초)
    float occlusion;                 // 0.0(완전차폐) ~ 1.0(개방)
    float transmission[kNumBands];   // 주파수 대역별 투과율
    float directivity;               // 0.0 ~ 1.0
};


// AirAbsorption 또는 FreqDependent Transmission 일 때만 EQEffect 사용
// 나머지는 GainEffect 만 사용 (더 가벼움)
auto applyEQ = (ApplyAirAbsorption || FreqDependent Transmission);


// 벽에 막혔지만 일부 투과되는 경우
gain = occlusion + (1 - occlusion) * transmission
// occlusion=0.5, transmission=0.5 → 0.5 + 0.5 * 0.5 = 0.75
// occlusion=1.0                   → 1.0 (완전 개방, 차폐 없음)
// occlusion=0.0, transmission=0.0 → 0.0 (완전 차폐)
```


---
# 3. 예제 코드

``` cpp fold title:Steam Audio C++
// 거리감쇠 + 공기흡수 + 차폐 + 투과 적용
DirectSoundPath path{};
path.distanceAttenuation = 0.5f;    // 50% 감쇠
path.airAbsorption[0]    = 0.9f;   // 저주파 거의 통과
path.airAbsorption[1]    = 0.5f;   // 중주파 절반
path.airAbsorption[2]    = 0.1f;   // 고주파 많이 감쇠
path.occlusion           = 0.3f;   // 70% 차폐
path.transmission[0]     = 0.5f;
path.transmission[1]     = 0.3f;
path.transmission[2]     = 0.1f;

DirectEffectParams params{};
params.directPath       = path;
params.flags            = ApplyDistanceAttenuation
                        | ApplyAirAbsorption
                        | ApplyOcclusion
                        | ApplyTransmission;
params.transmissionType = TransmissionType::FreqDependent;

directEffect->apply(params, monoIn, out);

```

<strong style="color:#b3f594">direct_effect.h</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/direct_effect.h)

<strong style="color:#b3f594">direct_effect.cpp</strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/direct_effect.cpp)

---
# 4. 실전 코드


``` cpp fold title:Steam Audio C++

DirectEffect::DirectEffect(const AudioSettings& audioSettings,
                           const DirectEffectSettings& effectSettings)
    : mNumChannels(effectSettings.numChannels)
    , mEQEffects(effectSettings.numChannels)
    , mGainEffects(effectSettings.numChannels)
{
    for (auto i = 0; i < effectSettings.numChannels; ++i)
    {
        mEQEffects[i] = make_unique<EQEffect>(audioSettings);
        mGainEffects[i] = make_unique<GainEffect>(audioSettings);
    }
}

void DirectEffect::reset()
{
    for (auto i = 0; i < mNumChannels; ++i)
    {
        mEQEffects[i]->reset();
        mGainEffects[i]->reset();
        //각 채널마다 eq/gain effect 생성성
    }
}

/*
 * apply()
 * DirectSoundPath 값 -> calculateGainAndEQ() -> EQ/Gain 적용
 *
 * eg)
 * falgs = ApplyDistanceAttenuation | ApplyAirAbsorption
 * airAbsorption = [0.9, 0.5, 0.1]
 *  -> overlallGain = 0.5f;
 *  -> eqCoeffs = [ 0.9, 0.5, 0.1]
 *  -> eqEffect 적용 후 gainEffect 적용
*/
AudioEffectState DirectEffect::apply(const DirectEffectParams& params,
                                     const AudioBuffer& in,
                                     AudioBuffer& out)
{
    float gain;
    float eqCoeffs[Bands::kNumBands];

    //gain coeff 값 계산 후 저장
    calculateGainAndEQ(params.directPath, params.flags,
					    params.transmissionType,
					    gain,
					    eqCoeffs);

	//EQ 적용해야 되는지 체크
    auto applyEQ = ((params.flags & ApplyAirAbsorption) ||
        ((params.flags & ApplyTransmission) &&
        params.transmissionType == TransmissionType::FreqDependent));

    for (auto i = 0; i < mNumChannels; ++i)
    {
        //채널별로 in/out buffer slice
        //eg) stereo out 의 i = 0 -> left buffer
        AudioBuffer inChannel(in, i);
        AudioBuffer outChannel(out, i);

        if (applyEQ)
        {
            EQEffectParams eqParams{};
            eqParams.gains = eqCoeffs;
            //eg)
            //airAbsorption = [0.9, 0.5, 0.1]라면
            // low 90% / mid 50% / high 10%

            mEQEffects[i]->apply(eqParams, inChannel, outChannel);
            // EQ filter로 주파수별 감쇠 적용
        }

        GainEffectParams gainParams{};
        gainParams.gain = gain;
        //eg) gain = 0.5 -> overall voluume 50%

        mGainEffects[i]->apply(gainParams, (applyEQ) ? outChannel : inChannel, outChannel);
    }

    return AudioEffectState::TailComplete;
}

AudioEffectState DirectEffect::tail(AudioBuffer& out)
{
    out.makeSilent();
    return AudioEffectState::TailComplete;
}

/*
 calculateGainAndEQ()
 directionSoundPath 값과 flags 를 받아서
 OverallGain과 eqCoeffs 를 계산

 order
 1. 거리         -> overllGain
 2. 공기 흡수     -> eqCoeffs
 3. 저항성        -> overallGain (multiply)
 4. 차페+투과     -> overallGain or eqCoeffs
 5. EQ normalize -> eqCoeff max 1.0 / cmmon factor = overallGain
*/
void DirectEffect::calculateGainAndEQ(const DirectSoundPath& directPath,
                                      DirectEffectFlags flags,
                                      TransmissionType transmissionType,
                                      float& overallGain,
                                      float* eqCoeffs)
{
    // 1. Apply distance attenuation.
    overallGain = (flags & ApplyDistanceAttenuation) ?
				   directPath.distanceAttenuation : 1.0f;

    // 2. pply air absorption.
    for (auto i = 0; i < Bands::kNumBands; ++i)
    {
        eqCoeffs[i] = (flags & ApplyAirAbsorption) ?
			           directPath.airAbsorption[i] : 1.0f;
        //eg) airAbosprtion[0.9, 0.5, 0.1]
        // cqCoeffs[0.9, 0.5, 0.1] -> applied
    }

    // 3. Apply directivity.
    if (flags & ApplyDirectivity)
    {
        overallGain *= directPath.directivity;
        //eg) directivity = 0.7 , overallGain = 0.5
        // overallGain = 0.5 * 0.7 = 0.35
    }

    // 4. Apply occlusion and transmission.
    if (flags & ApplyOcclusion)
    {
        if (flags & ApplyTransmission)
        {
            if (transmissionType == TransmissionType::FreqIndependent)
            {
                // Update attenuation factor with the average
	            // transmission coefficient and appropriately applied
                // occlusion factor.

                /* 주파수 무관 투과 : 평균 투과율로 overallGain 조정
                 eg) transmission[0.6, 0.4, 0.2], occlusion = 0.3
                  avg = (0.6 + 0.4 + 0.2) / 3 = 0.4
                  overallGain
                   = overallGain * occ + (1.0 - occ) * avg
                   = overallGain * 0.3 + (1.0 - 0.3) * 0.4
                   = overallGain * (0.3 + 0.28)
                */
                auto averageTransmissionFactor = .0f;
                for (auto i = 0; i < Bands::kNumBands; ++i)
                {
                    averageTransmissionFactor += directPath.transmission[i];
                }
                averageTransmissionFactor /= Bands::kNumBands;

                overallGain *= directPath.occlusion +
					(1 - directPath.occlusion) * averageTransmissionFactor;
            }
            else if (transmissionType == TransmissionType::FreqDependent)
            {
                // Update per frequency factors based on occlusion
                //and transmission value.

                /*
	                주펴수별 투과 -> eqCoeffs 각 대역에 적용
	                eg) transmission[0.6, 0.4, 0.2], occlusion = 0.3
	                eqcoeffs[0] *= 0.3 + 0.7 * 0.6 = 0.3 * 0.42 = 0.72
	                eqcoeffs[1] *= 0.3 + 0.7 * 0.4 = 0.3 + 0.28 = 0.58
	                eqcoeffs[2] *= 0.3 + 0.7 * 0.2 = 0.3 + 0.14 = 0.44
                */
                for (auto i = 0; i < Bands::kNumBands; ++i)
                {
                    eqCoeffs[i] *= directPath.occlusion +
                    (1 - directPath.occlusion) * directPath.transmission[i];
                }
            }
        }
        else
        {
            // Update attenuation factor with the occlusion factor only.
            //eg) occlusion = 0.3, overallGain = 0.5
            // overallGain = 0.5 * 0.3 = 0.15*
            overallGain *= directPath.occlusion;
        }
    }

    if ((flags & ApplyAirAbsorption) ||
        ((flags & ApplyTransmission) &&
        transmissionType == TransmissionType::FreqDependent))
    {
        // Maxium value in EQ filter should be normalized to 1 and
        // common factor rolled into attenuation factor,
        // this will allow for smooth changes to frequency changes
        // (possible exception is if maximum remains
        // and low / mid frequencies change dramatically).
        // Minimum value should be .0625 (24 dB) for any frequency
        // band for a good EQ response.

        /* eq) eqCoeffs[0.5, 0.25, 0.1], overallGain = 1.0
         max = 0.5 -> eqCoeffs[1.0, 0.5, 0.2] overallGain = 0.5
        */
        EQEffect::normalizeGains(eqCoeffs, overallGain);
    }
}

```

---


