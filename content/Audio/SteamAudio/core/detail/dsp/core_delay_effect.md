---
title: "[Core] DelayEffect"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-15
draft: "False"
description: "[SteamAudio] Delay Effect 분석 (core module)"
---

---

# 1. Introduction

- source <-> listener 거리에 따른 음속 전파 지연 (propagation delay) 구현에 사용


<strong style="color:#b3f594">1. Ring buffer</strong> 
- `rinbFuffer[MaxDelayInSampels]` 
- `writePos` - 순환 - `readpos` = `writePos - delayInSamples` (음수면 warp-round)

<strong style="color:#b3f594">2. Interpolation</strong> 
- 딜레이가 정수 샘플이 아니면 두 인접 샘플의 delay linear interpolation한다 
- 딜레이 값이 frame 사이에서 변하면 샘플마다 딜레이를 조금씩 바꿔가면 부드럽게 전환

<strong style="color:#b3f594">3. Tail</strong> 
- 딜레이만큼의 샘플이 ring buffer 남아 있다 -
- `apply()` 이후 `tail()` 을 호출해야 버퍼에 남은 소리를 다 꺼낼 수 있다

---
# 2. 구성 요소

- `DelayeffectSettings`
	- `maxDelayInSamples` - 링버퍼 사이즈
- `DelayEffectParams`
	- `delayInSamples` - 매 프레임 지정하는 실제 딜레이
- `ringBuffer`
	- `maxDelayInSamples`
		- 순환 버퍼 / 입력 샘플을 순서대로 저장
- `mPrevDelayInSamples`
	- 직전 프레임 delay 값, interpolation 시작점으로 사용
- `mNumTailSamplesRemainings`
	- Ring buffer에 아직 꺼내지 않은 샘플 수 - `tail` 종료 조건
- `mFirstFrame`
	- 첫 프레임에서는 interpolation 없이 바로 delay 시작

---

# 3. 예제 코드


``` cpp fold title:Steam Audio C++
AudioSettings audioSettings {48000, 1024};
DelayEffectSettings delaySettings {48000};
DelayEffect effect(audioSettings, delaySettings);

DelayEfectParams params;
params.delayInSamples = 4800; // 0.1 sec delay

AudioBuffer in(1, 1024);
AudioBuffer out (1,1024);

AudioEffectState = effect.apply(params, in, out);

while (state == AudioEffectState::TailRemaining)
{
    state = effect.tail(out);
}

```


<strong style="color:#b3f594">delay_effect.h </strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/delay_effect.h)

<strong style="color:#b3f594">delay_effect.cpp </strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/delay_effect.cpp)

<strong style="color:#b3f594">delay.h </strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/delay.h)

<strong style="color:#b3f594">delay.cpp </strong>
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/delay.cpp)

---
# 4. 실전 코드

``` cpp fold title:Steam Audio C++

//delay_effect.h

struct DelayEffectSettings
{
    int maxDelayInSamples = 0;

    DelayEffectSettings()
        : maxDelayInSamples(0)
    {}

    DelayEffectSettings(int maxDelayInSamples)
        : maxDelayInSamples(maxDelayInSamples)
    {}
};

struct DelayEffectParams
{
    int delayInSamples = 0;
};

class DelayEffect
{
public:
    DelayEffect(const AudioSettings& audioSettings,
                const DelayEffectSettings& effectSettings);

    void reset();

    AudioEffectState apply(const DelayEffectParams& params,
                           const AudioBuffer& in,
                           AudioBuffer& out);

    AudioEffectState tail(AudioBuffer& out);

    int numTailSamplesRemaining() const { return mNumTailSamplesRemaining; }

private:
    int mFrameSize;
    int mMaxDelayInSamples;
    Array<float> mRingBuffer;
    int mWritePos;
    float mPrevDelayInSamples;
    int mNumTailSamplesRemaining;
    bool mFirstFrame;
};

}

//-----------------------------------------------------------
// delay_effect.cpp
//-----------------------------------------------------------

DelayEffect::DelayEffect(const AudioSettings& audioSettings,
                         const DelayEffectSettings& effectSettings)
    : mFrameSize(audioSettings.frameSize)
    , mMaxDelayInSamples(effectSettings.maxDelayInSamples)
    , mRingBuffer(effectSettings.maxDelayInSamples)
//Ring buffer를 maxInDelaySamples size로 미리 할당
// eg) maxDelay = 48000 -> float 48000ea -> 192kb
{
    reset();
}

void DelayEffect::reset()
{
    mRingBuffer.zero();
    mWritePos = 0;
    mPrevDelayInSamples = 0.0f;
    mNumTailSamplesRemaining = 0;
    mFirstFrame = true;
}

AudioEffectState DelayEffect::apply(const DelayEffectParams& params,
                                    const AudioBuffer& in,
                                    AudioBuffer& out)
{
    assert(in.numSamples() == out.numSamples());
    assert(in.numChannels() == 1);
    assert(out.numChannels() == 1);

    PROFILE_FUNCTION();

    if (params.delayInSamples >= static_cast<int>(mRingBuffer.size(0)))
    {
        out.makeSilent();
        return AudioEffectState::TailComplete;

        //요청이 ringBuffer.size 이상이면 slince 출력
    }

    auto curDelayInSamples = mFirstFrame ? params.delayInSamples : mPrevDelayInSamples;
    //처음 프레임 : 즉시 목표 delay에서 시작
    //이후 프레임 : 이전 delay에서 부터 시작


    auto dDelayInSamples = mFirstFrame ? 0.0f :
    (params.delayInSamples - mPrevDelayInSamples) / mFrameSize;
    //프레임 내 sample 당 delay 변화량
    //eg ) 이전 4800, 현재 4900
    //frameSize= 1024 -> dealy = 100/1024 = 0.097

    for (auto i = 0; i < mFrameSize; ++i)
    {
        out[0][i] = 0.0f;

        mRingBuffer[mWritePos] = in[0][i];
        //store the current value to ring buffer

        int delayedSampleIndex[2];
        delayedSampleIndex[0] = static_cast<int>(floorf(mWritePos - curDelayInSamples));
        //delay 만큼 뒤의 정수 인덱스 floor

        delayedSampleIndex[1] = delayedSampleIndex[0] + 1;
        //다음 샘플 (interpolation 두번째 점)

        for (auto j = 0; j < 2; ++j)
        {
            if (delayedSampleIndex[j] < 0)
            {
                delayedSampleIndex[j] += static_cast<int>(mRingBuffer.size(0));
            }
            else if (delayedSampleIndex[j] >= static_cast<int>(mRingBuffer.size(0)))
            {
                delayedSampleIndex[j] -= static_cast<int>(mRingBuffer.size(0));
                //wrap-round로 index loop
            }
        }

        float weights[2];
        weights[1] = ceilf(curDelayInSamples) - curDelayInSamples;
        weights[0] = 1.0f - weights[1];
        //fractional처리
        //eg) 소수점 아래 부분의 반대 : 딜레이가 4700.3이면
        //weights[1] = 0.7 (더 가까운곳에 가중치)
        //weights[0] = 1.0 - weights[1];


        out[0][i] = weights[0] * mRingBuffer[delayedSampleIndex[0]] +
        weights[1] * mRingBuffer[delayedSampleIndex[1]];
		//두 buffer interpolation
		//delay가 정수 샘플이 아닐떼 pop/phase issue 방지

        mWritePos = (mWritePos + 1) % mRingBuffer.size(0);
		//write position 업데이트

        curDelayInSamples += dDelayInSamples;
        //딜레이를 조금 전환 -> 프레임 내에서 부드럽게 딜레이 변화
    }

    mPrevDelayInSamples = static_cast<float>(params.delayInSamples);
	//다음 시작점

    mNumTailSamplesRemaining = std::max(params.delayInSamples -
    mFrameSize, 0);
    // 딜레이 -> frame 크기이면 tail 남음
    //예) delay=4800, frameSize=1024, taile=3776 sample 남음

    return (mNumTailSamplesRemaining > 0) ?
    AudioEffectState::TailRemaining : AudioEffectState::TailComplete;
}

AudioEffectState DelayEffect::tail(AudioBuffer& out)
{
    assert(out.numChannels() == 1);
    assert(out.numSamples() == mFrameSize);

    if (mNumTailSamplesRemaining >= static_cast<int>(mRingBuffer.size(0)))
    {
        out.makeSilent();
        return AudioEffectState::TailComplete;
    }

    for (auto i = 0; i < mFrameSize; ++i)
    {
        int delayedSampleIndex = mWritePos - mNumTailSamplesRemaining;

        if (delayedSampleIndex < 0)
        {
            delayedSampleIndex += static_cast<int>(mRingBuffer.size(0));
        }
        else if (delayedSampleIndex >= static_cast<int>(mRingBuffer.size(0)))
        {
            delayedSampleIndex -= static_cast<int>(mRingBuffer.size(0));
        }
		//apply()이후 남은 샘플을 순서대로 읽기 (no input)

        out[0][i] = mRingBuffer[delayedSampleIndex];
        //ring Buffer tail sapmple 꺼내기 (interpolation index)

        mNumTailSamplesRemaining = std::max(mNumTailSamplesRemaining - 1, 0);
        //tail count 감소
    }

	//tail 다 소진하면 TailCompelete 반환
    return (mNumTailSamplesRemaining > 0) ?
    AudioEffectState::TailRemaining : AudioEffectState::TailComplete;
}
```

---

