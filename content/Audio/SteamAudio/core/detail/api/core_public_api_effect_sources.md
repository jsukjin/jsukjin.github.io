---
title: "[API] Effect C API wrappers"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "Steam Audio Effect C API wrapper별 역할과 공식 source 링크"
---
---
# 1. Introduction

이 문서는 public <strong style="color:#b3f594">Effect</strong> API를 내부 DSP object에 연결하는 wrapper 파일을 정리한다.
각 항목에는 파일의 역할과 Steam Audio 공식 source 링크를 둔다.

전체 호출 흐름은 [[core_public_api|Public C API 분석]]에서, effect 처리 개요는
[[core_04_effect_overview|Effect Overview]]에서 확인한다.

> [!info] 원본 코드 읽기
> 파일명 아래의 링크를 열면 해당 release tag의 원본 파일을 볼 수 있다.
> 이 문서는 코드를 복사해 싣지 않고, wrapper 책임과 탐색 경로를 안내한다.

# 2. 파일별 역할과 원본 링크

### <strong style="color:#b3f594">Ambisonics effects</strong>

## api_ambisonics_binaural_effect.cpp

Public parameter와 HRTF/audio buffer를 내부 Ambisonics binaural effect 입력으로 변환하고, 생성·수명 관리·처리를 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_binaural_effect.cpp)

## api_ambisonics_binaural_effect.h

Ambisonics binaural C API wrapper의 구현 클래스, 내부 handle과 공개 interface 연결을 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_binaural_effect.h)

## api_ambisonics_decode_effect.cpp

Ambisonics decode effect의 공개 설정과 buffer를 내부 decoder에 전달하고 생성·처리 호출을 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_decode_effect.cpp)

## api_ambisonics_decode_effect.h

Ambisonics decode wrapper의 클래스와 handle, lifecycle/process interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_decode_effect.h)

## api_ambisonics_encode_effect.cpp

입력 audio와 방향 파라미터를 내부 Ambisonics encoder 설정으로 변환해 effect 호출을 전달한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_encode_effect.cpp)

## api_ambisonics_encode_effect.h

Ambisonics encode C API wrapper의 내부 effect handle과 method interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_encode_effect.h)

## api_ambisonics_panning_effect.cpp

공개 panning 설정과 audio buffer를 내부 Ambisonics panning effect에 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_panning_effect.cpp)

## api_ambisonics_panning_effect.h

Ambisonics panning wrapper의 클래스, handle과 public interface 구현을 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_panning_effect.h)

## api_ambisonics_rotate_effect.cpp

Ambisonics 회전 파라미터와 입력·출력 buffer를 내부 rotate effect 호출로 전달한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_rotate_effect.cpp)

## api_ambisonics_rotate_effect.h

Ambisonics rotate C API wrapper의 클래스와 내부 effect handle을 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_ambisonics_rotate_effect.h)

### <strong style="color:#b3f594">Binaural effect</strong>

## api_binaural_effect.cpp

공개 binaural 설정, HRTF handle과 audio buffer를 내부 binaural renderer 처리로 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_binaural_effect.cpp)

## api_binaural_effect.h

Binaural effect wrapper의 API interface, 내부 handle과 lifecycle method를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_binaural_effect.h)

### <strong style="color:#b3f594">Direct effect</strong>

## api_direct_effect.cpp

Direct simulation parameter와 audio buffer를 내부 DirectEffect 처리에 전달하고 생성·해제 경계를 구현한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_direct_effect.cpp)

## api_direct_effect.h

Direct effect C API wrapper의 클래스, parameter 연결과 내부 handle interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_direct_effect.h)

### <strong style="color:#b3f594">Indirect effect</strong>

## api_indirect_effect.cpp

Reflection/reverb 설정과 impulse response 또는 reverb parameter를 내부 indirect effect 경로에 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_indirect_effect.cpp)

## api_indirect_effect.h

Indirect effect wrapper의 effect type, 내부 handle과 API method interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_indirect_effect.h)

### <strong style="color:#b3f594">Panning effect</strong>

## api_panning_effect.cpp

공개 speaker layout과 입력 audio를 내부 panning effect로 변환해 처리 호출을 전달한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_panning_effect.cpp)

## api_panning_effect.h

Panning effect C API wrapper의 클래스와 내부 handle interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_panning_effect.h)

### <strong style="color:#b3f594">Virtual surround effect</strong>

## api_virtual_surround_effect.cpp

공개 virtual surround 설정과 buffer를 내부 virtual surround renderer에 연결한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_virtual_surround_effect.cpp)

## api_virtual_surround_effect.h

Virtual surround wrapper의 공개 method, 내부 effect handle과 lifecycle interface를 선언한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_virtual_surround_effect.h)
