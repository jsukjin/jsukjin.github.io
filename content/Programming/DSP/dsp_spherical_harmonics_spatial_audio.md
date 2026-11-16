---
title: "[DSP] Spherical Harmonics와 Ambisonics"
author: KurtJang
tags: [Blog, "#Programming", "#DSP", "#Audio"]
date: 2026-11-12
draft: "False"
description: "구면 조화 함수 계수로 방향 음장을 표현하고 회전·렌더링하는 원리"
---

# 1. 방향 음장 표현

Spherical Harmonics(SH)는 구면 위 방향 함수의 기저다. 방향에 따른 음장을 SH 기저 계수들의 합으로 근사할 수 있다. order가 높아지면 표현할 수 있는 각도 변화가 세밀해지지만 coefficient 수와 처리 비용도 늘어난다. 3D full SH에서는 order N의 계수 수가 `(N+1)^2`다.

Ambisonics는 이 계수들을 오디오 채널로 저장·전달하는 포맷 계열이다. 채널 index는 일반 speaker의 위치와 같지 않으며 normalization과 channel ordering 규약을 따라야 한다.

# 2. 처리 흐름

```mermaid
flowchart LR
    Sources[방향별 음원] --> Encode[SH encoding]
    Encode --> Field[Ambisonics channels]
    Field --> Rotate[Listener-relative rotation]
    Rotate --> Decode[HRTF 또는 speaker decoder]
    Decode --> PCM[출력 채널]
```

회전은 방향 좌표를 바꾸는 효과를 coefficient 공간에 적용한다. Decoding은 SH field를 실제 speaker layout 또는 binaural ear signals로 바꾼다. SH rotation과 binaural convolution은 서로 다른 단계다.

# 3. 독립 C++ 아이디어

``` cpp fold title:SH coefficient 개수
int full3DShCoefficientCount(int order)
{
    const int bands = order + 1;
    return bands * bands;
}
```

이는 coefficient 수만 계산하며 basis 생성, channel ordering, normalization, rotation matrix, decoding은 구현하지 않는다.

# 4. Steam Audio 연결

`ambisonics_rotation.*`, `ambisonics_binaural_effect.*`, `ambisonics_panning_effect.*`에서 계수 차원, rotation, decoder를 구분해서 읽는다. [[Audio/SteamAudio/core/detail/spatialization/core_spatial_rendering|Spatial rendering source guide]]를 참고하고, 바이노럴 decoding은 [[dsp_hrtf_binaural|HRTF 문서]]로 이어간다.
