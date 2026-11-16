---
title: "[Core] EQEffect"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-15
draft: "False"
description: "[SteamAudio] EQ Effect 분석 (core module)"
---

---

# 1. Introduction

- EQEffect는 오디오 신호에 주파수 밴드별 게인(gain)을 실시간으로 적용한다

<strong><font color="#b3f594">1. Bands 구조</font></strong>

| 밴드   | 주파수 범위          | 필터 종류     |
| ---- | --------------- | --------- |
| Low  | 0 ~ 800 Hz      | LowShelf  |
| Mid  | 800 ~ 8000 Hz   | peaking   |
| High | 8000 ~ 22000 Hz | HighShelf |

<strong><font color="#b3f594">2. 더블 버퍼링 + 크로스페이드 (pop 방지)</font></strong>

- gain이 바뀔 때 IIR 필터를 즉시 교체하면 pop 사운드가 생긴다
- 따라서 필터 슬롯은 2개 유지하고, 프레임 하나 동안 이전/새 필터를 교체한다

<strong><font color="#b3f594">3. Tail 없음</font></strong>

- IIR 필터는 연속 처리요 이므로 오디오 블록이 끊겨도 꼬리 샘플이 없다

---

# 2. 구성 요소

`EQQeffectParam` 
- `gains[kNumBands]` -각 밴드에 꼽한 섢형 개인 (0.0 ~ 1.0 이상도 가능) 
- `mFilters[band][slot]` - `IIRFilter` 2개 슬롯 (double buffering)   
  bands = 0,1,2 / slot =0.1 
- `mTemp` - 이전 gain으로 처리된 임시 결과 버퍼 (cross-fade blending 용) -
- `mPrevGains[kNumBands` - 직전 프레임에서 쓴 게인, 변화 여부 감지에 사용 
-  `mCurrent` - 현재 활성 슬롯 인덱스(0


---
# 3. 실전 코드

``` cpp fold title:Steam Audio C++

//-----------------------------------------------------------
// eq_effect.h
//-----------------------------------------------------------
struct EQEffectParams
{
    const float* gains = nullptr;
    //gain 배열 - 반드시 kNumBands 개의 element를 보유해야 함
};

class EQEffect
{
public:
    EQEffect(const AudioSettings& audioSettings);

    void reset();

    AudioEffectState apply(const EQEffectParams& params,
                           const AudioBuffer& in,
                           AudioBuffer& out);

    AudioEffectState tail(AudioBuffer& out);

    AudioEffectState tailApply(const AudioBuffer& in, AudioBuffer& out);

    int numTailSamplesRemaining() const { return 0; }

    static void normalizeGains(float* eqGains,
                               float& overallGain);

private:
    int mSamplingRate;
    int mFrameSize;

    // Filters[밴드 인덱스][슬롯 0 ~ 1]
    IIRFilterer mFilters[Bands::kNumBands][2];

    //corss fade 용 임시 buffer
    Array<float> mTemp;
    float mPrevGains[Bands::kNumBands];

    //crurent slot
    int mCurrent;
    bool mFirstFrame;

    void setFilterGains(int index,
                        const float* gains);

    void applyFilterCascade(int index,
                            const float* in,
                            float* out);
};

//-----------------------------------------------------------
// eq_effect.cpp
//-----------------------------------------------------------
EQEffect::EQEffect(const AudioSettings& audioSettings)
    : mSamplingRate(audioSettings.samplingRate)
    , mFrameSize(audioSettings.frameSize)
    , mTemp(audioSettings.frameSize)
{
    reset();
}

void EQEffect::reset()
{
    for (auto i = 0; i < Bands::kNumBands; ++i)
    {
        mPrevGains[i] = 1.0f;
    }

    setFilterGains(0, mPrevGains);
    //set gain {0,0,0} in slot 0

    setFilterGains(1, mPrevGains);
    //set gain {0,0,0} in slot 1

    mCurrent = 0;
    //set active slot as 0

    mFirstFrame = true;
    //set true so that apply() is not applied when cross fading
}

AudioEffectState EQEffect::apply(const EQEffectParams& params,
                                 const AudioBuffer& in,
                                 AudioBuffer& out)
{
    assert(in.numSamples() == out.numSamples());
    assert(in.numChannels() == 1);
    assert(out.numChannels() == 1);

    PROFILE_FUNCTION();

    if (mFirstFrame)
    {
        for (auto i = 0; i < Bands::kNumBands; ++i)
        {
            mPrevGains[i] = params.gains[i];
            //gain copy
        }

        setFilterGains(mCurrent, params.gains);
		//update gain for filter param
		//eg)
		//gains = {0.5, 1.0, 0.0} ->
		//lowShelf(800Hz, 0.5), peaking(800~8000, 1.0), highShelf(8000, 0,8)

        mFirstFrame = false;
        //allow cross fading from the next frame
    }

    auto gainsChanged = false;
    for (auto i = 0; i < Bands::kNumBands; ++i)
    {
        if (mPrevGains[i] != params.gains[i])
        {
            gainsChanged = true;
            break;
        }
    }

    if (gainsChanged)
    {
        auto previous = mCurrent;
        mCurrent = 1 - mCurrent;
        //slot flip 0 ~ 1

        setFilterGains(mCurrent, params.gains);
        //update new gain value in new slot

        for (auto i = 0; i < Bands::kNumBands; ++i)
        {
            mFilters[i][mCurrent].copyState(mFilters[i][previous]);
            //copy the filters state (xm1, xm2, xm3) to new slot
        }

        applyFilterCascade(previous, in[0], mTemp.data());
        //apply gain to the previous one and store it to temp

        applyFilterCascade(mCurrent, in[0], out[0]);
        //apply gain to new one and store ot to out


        for (auto i = 0; i < mFrameSize; ++i)
        {
            const float i = stati_cast<float>(i);
            const float frameSize = static_cast<float>(mFrameSize);
            float weight = i / frameSize;
        //eg) 0 sample = 0.0 (previous 100%), 1023 smaple = 1.0 (new 100%)

            out[0][i] = weight * out[0][i] + (1.0f - weight) * mTemp[i];
            //linear cross fade

        }

        for (auto i = 0; i < Bands::kNumBands; ++i)
        {
            mPrevGains[i] = params.gains[i];
            //save current gain for the next frame
        }
    }
    else
    {
        applyFilterCascade(mCurrent, in[0], out[0]);
        //no gain change
    }

    return AudioEffectState::TailComplete;
}

AudioEffectState EQEffect::tailApply(const AudioBuffer& in, AudioBuffer& out)
{
    EQEffectParams prevParams{};
    prevParams.gains = mPrevGains;

    return apply(prevParams, in, out);
}

AudioEffectState EQEffect::tail(AudioBuffer& out)
{
    out.makeSilent();
    return AudioEffectState::TailComplete;
}

void EQEffect::setFilterGains(int index,
                              const float* gains)
{
    mFilters[0][index].setFilter(IIR::lowShelf(Bands::kHighCutoffFrequencies[0],
                                gains[0],
                                mSamplingRate));
    //band 0 : 0~800Hz lowshelf
    //eg) gain 0.5  -> 0~800 high-cut -6dB decreased

    for (auto i = 1; i < Bands::kNumBands - 1; ++i)
    {
        mFilters[i][index].setFilter(IIR::peaking(Bands::kLowCutoffFrequencies[i],
                               Bands::kHighCutoffFrequencies[i],
                               gains[i],
                               mSamplingRate));
        //band 1 (mid) :  0~800 peaking
    }

    mFilters[Bands::kNumBands - 1][index].setFilter(IIR::highShelf(Bands::kLowCutoffFrequencies[Bands::kNumBands - 1],
                                 gains[Bands::kNumBands - 1],
                                 mSamplingRate));
    //band 2 (mihg) : 8000 above high shelf
}

void EQEffect::applyFilterCascade(int index,
                                  const float* in,
                                  float* out)
{
    mFilters[0][index].apply(mFrameSize, in, out);
    //band 0 - apply (low-shelf) filter to in buffer

    for (auto i = 1; i < Bands::kNumBands; ++i)
    {
        mFilters[i][index].apply(mFrameSize, out, out);
        // case case (previous out -> next in)
        //result - 3 bands applied filter (summerized)
    }
}

void EQEffect::normalizeGains(float* eqGains,
                              float& overallGain)
{
    const auto kMaxEQGain = 0.0625f;
    //min gain = 1/16 = -24dB

    auto maxGain = 0.0f;
    for (auto i = 0; i < Bands::kNumBands; ++i)
    {
        maxGain = std::max(maxGain, eqGains[i]);
        //get max among the 3 bands
    }

    if (maxGain < std::numeric_limits<float>::min())
    {
        overallGain = 0.0f;
        for (auto i = 0; i < Bands::kNumBands; ++i)
        {
            eqGains[i] = 1.0f;
            //to set 1.0(normal) for netural filter
        }
    }
    else
    {
        for (auto i = 0; i < Bands::kNumBands; ++i)
        {
            eqGains[i] /= maxGain;
            //gain normalization
            //eg (0.2/0.8, 0.8/0.8, 0.4/0.8) = {0.25, 1.0, 0.5}
            eqGains[i] = std::max(eqGains[i], kMaxEQGain);
            //-24dB clamping
        }

        overallGain *= maxGain;
    }
}

}

```


> [!info] Summary
> 1. pop 방지를 위해 2개의 IIR  필터를 blending 한다
> 2. coefficient가 동일한 temp buffer에 previous x,y state를 복사해온다
> 3. 그 이후 temp buffer에서 gain값을 가져와서 weight 맞게 blending 한다


<strong style="color:#b3f594">eq_effect.h</strong>
- [eq_effect.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/eq_effect.h)

<strong style="color:#b3f594">eq_effect.cpp</strong>
- [eq_effect.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/eq_effect.cpp)

<strong style="color:#b3f594">iir.h</strong>
- [iir.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/iir.h)

<strong style="color:#b3f594">iir.cpp</strong>
- [iir.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/iir.cpp)

<strong style="color:#b3f594">bands.h</strong>
- [bands.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bands.h)

<strong style="color:#b3f594">bands.cpp</strong>
- [bands.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bands.cpp)

---


