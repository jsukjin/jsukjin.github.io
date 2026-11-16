---
title: "[DSP] dB, IIR Filter와 대역별 EQ"
author: KurtJang
tags: [Blog, "#Programming", "#DSP", "#CPP"]
date: 2026-11-12
draft: "False"
description: "dB 변환, 1차 IIR 필터 state와 주파수 대역 EQ 적용"
---

# 1. dB와 진폭

진폭 비율 `g`를 dB로 바꾸면 `20 log10(g)`이고, dB 값을 선형 gain으로 바꾸면 `10^(dB/20)`이다. 예를 들어 -6 dB는 대략 진폭의 절반이다. 에너지 비율에는 `10 log10`을 쓰므로 진폭과 에너지 공식을 섞지 않는다.

# 2. IIR 필터의 핵심

IIR 필터 출력은 현재/이전 입력과 이전 출력의 조합이다. 간단한 1차 저역통과 형태는 `y[n] = (1-a)x[n] + a y[n-1]`이며 `y[n-1]`이 state다. 계수 `a`는 cutoff와 sample rate로 계산한다. 안정한 범위를 벗어난 계수는 신호를 발산시킬 수 있다.

```mermaid
flowchart LR
    X[현재 입력 x[n]] --> Sum[가중 합]
    X --> A[입력 계수 1-a]
    Prev[이전 출력 y[n-1]] --> FB[피드백 계수 a]
    A --> Sum
    FB --> Sum
    Sum --> Y[출력 y[n]]
    Y --> Delay[한 샘플 지연]
    Delay --> Prev
```

# 3. 독립 C++ 예제

``` cpp fold title:1차 IIR low-pass state
struct OnePoleLowPass
{
    float a = 0.0f;
    float previousOutput = 0.0f;

    float process(float input)
    {
        previousOutput = (1.0f - a) * input + a * previousOutput;
        return previousOutput;
    }
};
```

예제는 필터 구조를 보여주는 최소 코드다. 실제 계수는 cutoff와 sample rate를 바탕으로 만들고, 채널마다 독립 state를 두며, filter reset/denormal/parameter smoothing도 고려한다.

# 4. 주파수 대역 EQ와 감쇠

대역별 gain은 각 주파수 구간의 성분을 따로 조절하는 개념이다. 실제 구현은 crossover/filter bank 또는 변환 도메인 처리로 대역을 분리한 뒤 각 band gain을 적용한다. 특정 대역 gain을 곱하는 것으로 모든 주파수를 독립적으로 정확히 나눌 수 있는 것은 아니므로 crossover 구현을 확인해야 한다.

Air absorption은 거리와 공기 특성에 따라 고주파 성분이 상대적으로 더 줄어드는 현상을 근사한다. Core의 결과 계수 계산은 [[core_air_absorption|Air Absorption 분석]], 별도 path EQ 적용은 [[core_path_effect|PathEffect 분석]]에 있다.

# 5. 공부 순서

먼저 buffer layout을 [[dsp_audio_buffer_and_block_processing|Audio Buffer 문서]]에서 익힌다. 이후 [[core_dsp_modules|Core DSP modules]]에서 filter 계수 생성과 block processing 호출 위치를 찾아본다.
