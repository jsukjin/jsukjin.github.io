---
title: "[API] 공개 C 계약과 API forwarding"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "Steam Audio 계약 API 파일 링크와 파일별 책임 설명"
---
---
# 1. Introduction

Public ABI declaration에서부터 context, scene,simulator, baking, validation adapter까지 읽는다.
이 문서는 앞의 상세 API/build 문서에서 설명한 호출 흐름을 파일 단위 원본으로 
확인하는 자료다. 각 파일을 별도 접기 블록으로 제공하고,  블록 안의 [파일 역할] 주석은 
문서용 설명이며 나머지는 저장소 원본이다.

> [!info] 버전 고정
> 공식 원본은 Steam Audio v4.8.1 release tag를 기준으로 연결한다. 
> 전체 SDK 호출 개요는 [Public C API 분석](./core_public_api.md)에서 확인한다.

---
# 2. 파일별 원본과 역할

<strong style="color:#b3f594">api_advanced_simulation.cpp</strong>
- [api_advanced_simulation.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_advanced_simulation.cpp)

- 고급 simulation 및 offline baking API를 내부 simulator/baker 작업으로 forwarding한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_advanced_simulation.cpp)


## api_audio_buffer.cpp 

- audio buffer 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_audio_buffer.cpp)

## api_baking.cpp 

- 고급 simulation 및 offline baking API를 내부 simulator/baker 작업으로 forwarding
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_baking.cpp)

## api_context.cpp 

- Context 생성/해제 API를 내부 context factory와 handle로 연결
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_context.cpp)

## api_context.h 

- context wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_context.h)

## api_geometry.cpp 

- Scene/geometry public API와 내부 scene/mesh 객체 사이의 생성·변경·호출 경계를 구현
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_geometry.cpp)

## api_scene.cpp 

- Scene/geometry public API와 내부 scene/mesh 객체 사이의 생성·변경·호출 경계를 구현현
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_scene.cpp)

## api_scene.h 

- scene wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_scene.h)

## api_serialized_object.cpp 

- serialized object 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_serialized_object.cpp)

## api_serialized_object.h 

- serialized object wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_serialized_object.h)

## api_simulator.cpp 

- Simulator 생성, 설정, 실행, 결과 접근 API를 내부 simulator interface로 forwarding
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_simulator.cpp)

## api_simulator.h 

- simulator wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_simulator.h)

## api_validation_layer.cpp 

- API 호출의 입력과 상태를 검사하는 validation layer forwarding 구현
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_validation_layer.cpp)

## docs.h 

- 공개 API 타입과 함수의 Doxygen 문서 주석을 모아둔 reference 문서 헤더다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/docs.h)

## phonon.h 

- 공개 IPL 타입, 설정 구조체, 함수 선언으로 구성된 C ABI 계약이다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h)

---
