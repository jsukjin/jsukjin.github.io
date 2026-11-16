---
title: "[Core] AudioBuffer"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-11
draft: "False"
description: "[SteamAudio] AudioBuffer 분석 (core module)"
---

---
# 1. Introduction

- `AudioBuffer` 는 DSP 처리에 사용되는 de-<strong style="color:#b3f594">interleaved</strong> Audio buffer이다
- 모든 <strong style="color:#b3f594">Effect</strong> (Paning, binaural, <strong style="color:#b3f594">Convolution</strong> 등) 의 입출력
  타입으로 사용된다

<strong><font color="#b3f594">1. De-Interleaved 방식</font></strong> 
- PortAudio의 interleaved 방식과 반대다 
- 채널별로 데이터가 분리되어 있어 DSP 처리가 효율적이다

<strong><font color="#b3f594">2. 3가지 생성자</font></strong> -
- 데이터를 직접 소유하거나 외부 데이터를 참조만 하거나 다른 버퍼의
  단일 채널로만 참조 할 수 있다


<strong><font color="#b3f594">3. mData 포인터 이중역할</font></strong> 
- 내부 데이터를 소유할 때와 외부 데이터를 참조할때 모두 `mData` 로 접근한다

---

# 2. 구성 요소

`AudioSettings` 
- `SamplingRate` : Sample rate (예 : 44100, 48000) 
- `frameSize` : 한번에 처리할 프레임 수 (예 : 256, 512) 
- Effect 초기화 시 설정값 전달 용도  
	- `AudioEffectState` - `TailRemaining` : reverb 잔향 등 아직 처리할 데이터가 남아 있음 
	- `TailComplete` -  처리 완료

---

# 3. 예제 코드



``` cpp fold title:Steam Audio C++

// Interlaved vs de-interleaved

//PortAudio (Interleaved)
float interleaved[] = {L0, R0, L1, R1, L2, R2};

//AudioBuffer (de-interleaved)
float channels0[] = {L0, L1, L2};
float channels1[] = {R0, R1, R2};

```


> [!info] De-interlaved 가 DSP에 유리한 이유?
> 채널 하나에 <strong style="color:#b3f594">SIMD</strong> 연산 적용이 가능하다
> 예) deinterleave  = L0,L1,L2,L3 = 한번에 SSE 처리
>
>

### audio_buffer.h 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/audio_buffer.h)
### audio_buffer.cpp 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/audio_buffer.cpp)

---

# 4. 실전 코드

``` cpp fold title:Steam Audio C++
class AudioBuffer
{
public:
AudioBuffer(int numChannels, int numSamples)
    : mNumChannels(numChannels)
    , mNumSamples(numSamples)
    , mInternalData(numChannels, numSamples)
    , mDasta(minternalData.get())
    //Array<float,2> 로 2D 배열 할당
    //eg) Array<float,2> (512) = float[2][512]
{}

AudioBuffer(int numChannels, int numSamples, float* const* data)
    :mNumChannels(numChannels)
    ,mNumSamples(numSamples)
    ,mData(data)
    //mInternalData = nullptr
    //mData가 외부 배열을 가리킴
{}

AudioBuffer(const AudioBuffer& other, int channel)
    :mNumChannels(1)
    ,mNumSamples(other.numSamples)
    ,mData(other.mData[Channel])
    //other의 channel 번째 채널만 참조
    //값 : stereo[0] -> 왼쪽 채널만 mono buffer
{}

void AudioBuffer::read(float* out) const
{
    //de-interleaved -> interleaved conversion
    for (auto i = 0, index = 0; i < mNumSamples; ++i)
    {
        for (auto j = 0; j < mNumChannels; ++j, ++index)
        {
            out[index] = mData[j][i];
        }
    }
    //eg ) 2-channels, 3 samples
    //mData[0] = {L0,L1,L2};
    //mData[1] = {R0,R1,R2};
	//out = {L0,R0,L1,R1,L2,R2}
}

void AudioBuffer::write(const float* in)
{
    //interleaved -> de-interleaved conversion
    for (auto i = 0, index = 0; i < mNumSamples; ++i)
    {
        for (auto j = 0; j < mNumChannels; ++j, ++index)
        {
            mData[j][i] = in[index];
        }
    }
    //eg) 2-channels, 3 samples
    //in       = {L0, R0, L1, R1, L2, R2}
    //mData[0] = {L0, L1, L2}
    //mData[1] = {R0, R1, R2}
}

void AudioBuffer::mix(const AudioBuffer& in, AudioBuffer& out)
{
	//out += in (채ㅓㄴㄹ별 덧셈)
    for (auto i = 0; i < in.NumChannels(); ++i)
    {
        ArrayMath::add(in.numSamples(), in[i], out[i], out[i]);
    }

    //eg)
    //in[0]      = {0.1, 0.2, 0.3}
    //out[0]     = {0.4, 0.5, 0.6}
    //result     = {0.5, 0.7, 0.9}
}

void AudioBuffer::downmix(const AudioBuffer& in, AudioBuffer& out)
{
    //multichannel -> mono
    std::memcpy(out[0], in[0], in.numSamples() * sizeof(float));

    for (auto i = 1; i < in.numChannels(); ++i)
    {
        ArrayMath::add(in.NumSamples(), int[i], out[0], out[0]);
    }

    ArrayMath::scale(in.numSamples(), out[0], 1.0f, / in.numChannels(). out[0]);
    //channel 수로 나눠서 평균
    //eg) 2 channels
    // in[0] = {0.4, 0.6}
    // in[1] = {0.2, 0.8}
    // out[0] = {0.3, 0.7} -> {(0.4 + 0.2) / 2, (0.6 + 0.8)/ 2}
}

private:
    int mNumChannels;
    int mNumSamples;

    Array<float,2> mInternalData;
    //생성자1 에서만 실제 데이터 보유
    //생성자 2,3 에서는 비어있음

    float* const* mData;
	//항상 이걸로 데이터 접근
	//생성자1 : mInternalData를 가리킴
	//생성자2 : 외부 배열을 가르킴
	//생성자3 : other.mData[channel]을 가리킴
}


```


---

