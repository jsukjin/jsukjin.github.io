---
title: "[Core] PanningEffect"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - CPP
  - SteamAudio
date: 2026-05-12
draft: "false"
description: "[SteamAudio] Panning Effect 분석 (core module)"
---

---

# 1. Introduction

- mono 입력 -> multi-channel 출력으로 변환 (spatialization 효과)
- 소리방향 (`Vector3f direction`) 을 받아 각 스피커에 배분할 가중치(weight)를 계산
- <strong style="color:#b3f594">FFT</strong> / <strong style="color:#b3f594">convolution</strong> 없이 순수 Gain 만으로 작동 (panning 기본요소)

---
# 2. 구성요소

``` cpp fold title:Steam Audio C++
struct PanningEffectSetttings
{
    //Stereo / 5.1 / 7.1 등
    const SpeakerLayout* spekaerLaytout;
}

//매 프레임 소리 방향 입력
strcut PanningEffectParam
{
    const Vector3f* direction //소리가 오는 방향
}

```

| Layout           | algorithm                 | note                    |
| ---------------- | ------------------------- | ----------------------- |
| Mono             | 항상 1.0f                   | 계산 X                    |
| Stereo           | `stereoPaningWeight`      | con/sin constant- power |
| Qaud / 5.1 / 7.1 | `PairwisePanningWeight`   | 인접 스피커 2개에만 배분          |
| Custom           | `firstOrderPanningWeight` | 내적(dot-product)기반       |

## 특이사항

- Crossfade - 방향이 갑자기 바뀔 때 튀는 소리 방지

``` cpp fold title:Steam Audio C++
// 이전 프레임 가충치 -> 현재 프레임 가중치로 선형 보정
auto alpha = (float) j / (float) in.numSamples();
auto blendedWeight = alpha * weight + (1.0f - alpha) * weightPrev;
```

- pairwise - 5.1/7.1에서 인접한 2개 스피커만 활성화 / 나머지는 0

``` cpp fold title:Steam Audio C++
//azimuth 각도로 스피커 pair 결정
if (index == speakerIndices[0]) return consf();
els if (index == speakerIndices[1]) return sinf;
else return 0.0f;
```


---
# 3. 예제 코드

``` cpp fold title:Steam Audio C++
//stereo constant power panning method
// direction.x : -1 (left)  ~ +1 (right)
float p = direction.x();
float q = (p + 1) * (pi / 4); // 0 ~ 2_PI mapping

float weightL = cosf(q);    //left speaker
float weightR = sinf(q);    //right speaker
//cos^2 (q) + sin^2(q) = 1 에너지의 합은 항상 일정

```

---


<strong style="color:#b3f594">panning_effect.h</strong>
- [panning_effect.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/panning_effect.h)

<strong style="color:#b3f594">panning_effect.cpp</strong>
- [panning_effect.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/panning_effect.cpp)

# 4. 실전 코드

``` cpp fold title:Steam Audio C++
AudioEffectState PanningEffect::apply (const PanningEffectParam& params,
                                       const AudioBuffer& in,
                                       AudioBuffer& out)
{

}


```


---

## ETC. phi 반시계 방향 이유

### 1. 개념

Steam Audio 좌표계에서 **앞방향이 -z** 입니다. 일반 수학 좌표계와 반대이기 때문에 
phi가 반시계로 증가합니다.

`atan2(x, z)` 에 각 방향을 대입하면:

```
정면   (x=0,  z=-1) → atan2(0,  -1) = π
왼쪽   (x=-1, z=0)  → atan2(-1,  0) = -π/2
오른쪽 (x=1,  z=0)  → atan2(1,   0) = +π/2
```

여기에 `+π` 를 더하면:

```
정면   π   + π = 2π → fmodf → 0
왼쪽  -π/2 + π = π/2    ← 작은 값
오른쪽 π/2 + π = 3π/2   ← 큰 값
```

0에서 증가할수록 왼쪽으로 가므로 **반시계**가 됩니다.

#### 구성 요소 / 특이사항

|방향|x|z|atan2(x,z)|+π 후|phi|
|---|---|---|---|---|---|
|정면|0|-1|π|2π|0 (fmodf)|
|왼쪽|-1|0|-π/2|π/2|π/2|
|후방|0|1|0|π|π|
|오른쪽|1|0|π/2|3π/2|3π/2|

**앞방향이 -z 인 이유** — Steam Audio는 OpenGL 관례를 따릅니다. 
카메라/리스너가 -z 방향을 바라보는 Right-handed 좌표계입니다.

---

### 2. 예제 코드

cpp

``` cpp fold title:Steam Audio C++
// 각 방향의 phi 값 직접 계산
float kPi = 3.14159f;

// 정면 (0, 0, -1)
float phi = fmodf(kPi + atan2f(0.0f, -1.0f), 2 * kPi);
// = fmodf(π + π, 2π) = fmodf(2π, 2π) = 0 ✅

// 왼쪽 (-1, 0, 0)
phi = fmodf(kPi + atan2f(-1.0f, 0.0f), 2 * kPi);
// = fmodf(π + (-π/2), 2π) = π/2 ✅

// 오른쪽 (1, 0, 0)
phi = fmodf(kPi + atan2f(1.0f, 0.0f), 2 * kPi);
// = fmodf(π + π/2, 2π) = 3π/2 ✅
```

---

### 3. 실전 코드

cpp

``` cpp fold title:Steam Audio C++
SphericalVector3(const Vector3<T>& cartesian)
{
    radius    = cartesian.length();
    elevation = asin(cartesian.y() / radius);

    if (abs(elevation - Math::kHalfPi) < 1e-5f ||
        abs(elevation + Math::kHalfPi) < 1e-5f)
    {
        azimuth = 0; // 정수직 위/아래 → azimuth 정의 불가 → 0 고정
    }
    else
    {
        // 앞방향 = -z 이므로
        // atan2(x, z) : 정면(-z)에서 반시계로 증가
        // +π : 범위를 -π~π → 0~2π 로 이동
        // fmodf : 2π를 0으로 wrap
        azimuth = fmodf(Math::kPi + atan2(cartesian.x(), cartesian.z()),
                        2 * Math::kPi);
    }
}
```


---
