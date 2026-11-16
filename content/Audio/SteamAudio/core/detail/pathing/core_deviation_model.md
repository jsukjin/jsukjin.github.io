---
title: "[Core] DeviationModel과 경로 diffraction EQ"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "Probe path의 bend angle을 대역별 diffraction attenuation으로 바꾸는 모델"
---

# 1. Introduction

deviation.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.h) / deviation.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.cpp)는 <strong style="color:#b3f594">probe</strong> 경로의 방향 꺾임(deviation angle)을
frequency-band gain으로 바꾸는 모델을 제공한다. 
PathSimulator가 여러 segment의 bend angle을 모아 EQ coefficient에 반영한다. 
이는 단순한 거리에 따른 감쇠와 다른 효과다.

- 경로 angle 생산: [[core_path_data|SoundPath distance/deviation 데이터]]
- 적용 결과: [[core_path_simulator|PathSimulator의 EQ 결과]]
- 최종 오디오 처리: [[core_path_effect|PathEffect 렌더링]]
- 선행 DSP 개념: [[Programming/DSP/dsp_iir_filter_basics|Frequency-band EQ 기초]]

---
# 2. 모델 개념

Path가 꺾일수록 diffraction으로 전달되는 에너지가 줄어들 수 있다. 
Core는 total deviation과 대역 index를 받아 gain을 계산한다. 
Default model은 UTD(Uniform Theory of <strong style="color:#b3f594">Diffraction</strong>) 기반 함수를 쓰고, 사용자가 callback을 
제공하면 callback으로 대체한다.

> [!warning] 물리 모델의 범위
> 이 값은 <strong style="color:#b3f594">pathing</strong> pipeline에서 쓰는 실용적 대역 감쇠 모델이다. 
> scene의 모든 diffraction 현상을 파동
> 방정식으로 직접 푸는 결과로 해석하지 않는다.

---
# 3. Steam Audio 코드 분석

``` cpp fold title:deviation.cpp 실제 코드 발췌
float DeviationModel::evaluate(float angle, int band) const
{
    if (mCallback)
    {
        return mCallback(angle, band, mUserData);
    }
    else
    {
        return utdDeviation(angle, band);
    }
}
```

`calcDeviationTerm`은 band마다 model을 평가하고, `PathSimulator::calcEQForPaths`가 
path weight와 reference normalization을 반영해 output EQ gains를 만든다. 
정확한 default curve는 `utdDeviation` 구현을 기준으로 읽는다.

<strong style="color:#b3f594">deviation.h</strong>
- [deviation.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.h)

<strong style="color:#b3f594">deviation.cpp</strong>
- [deviation.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.cpp)

---
# 4. 사용법

Custom model을 쓸 때는 angle 단위와 band index 규약이 callback과 Core 설정에 
일치해야 한다. API settings의 callback lifetime/userData 수명도 유지한다. 
Model을 끄거나 custom callback을 쓰는 설정은 phonon.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h)의 Pathing settings와
api_simulator.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_simulator.cpp) 변환을 확인한다.

--- 
# 5. 독립 C++ 핵심 예제

``` cpp fold title:독립 bend angle gain 예제
#include <algorithm>
#include <cmath>

float bendGain(float angleRadians, float sensitivity)
{
    return std::exp(-sensitivity * std::max(0.0f, angleRadians));
}
```

독립 예제는 bend가 커질수록 gain이 줄어드는 관계만 보인다. 
Steam Audio의 default UTD 식과 per-band normalization을 대체하지 않는다.

---
# 6. Source file inventory

- <strong style="color:#b3f594">deviation.h</strong> [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.h)
	-  callback 기반 `DeviationModel` API  
	
-<strong style="color:#b3f594">deviation.cpp</strong>  [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/deviation.cpp) -
	-  callback/default model selection 및 UTD 계산

---


