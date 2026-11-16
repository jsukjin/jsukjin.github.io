---
title: "[API] Backend와 데이터 객체 API wrappers"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "Steam Audio 공개 API 파일 링크와 파일별 책임 설명"
---
---

# 1. Introduction

Device, <strong style="color:#b3f594">HRTF</strong>, energy field, impulse response, probes, reconstructor 등 고급 객체의 
C API 연결을 다룬다. 이 문서는 앞의 상세 API/build 문서에서 설명한 호출 흐름을 
파일 단위 원본으로  확인하는 자료다. 
각 파일을 별도 접기 블록으로 제공하고, 블록 안의 [파일 역할]  주석은 문서용 설명이며 
나머지는 저장소 원본이다.

> [!info] 버전 고정
> 공식 원본은 Steam Audio v4.8.1 release tag를 기준으로 연결한다. 
> 전체 SDK 호출 개요는 [Public C API 분석](core_public_api.md)에서 확인한다.

# 2. 파일별 원본과 역할

## api_embree_device.cpp 

- embree device device API의 생성과 리소스 수명을 내부 backend 객체에 연결
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_embree_device.cpp)

## api_embree_device.h 

- embree device wrapper의 interface, 설정, 상태 및 handle 선언
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_embree_device.h)

## api_energy_field.cpp 

- energy field 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_energy_field.cpp)

## api_energy_field.h 

- energy field wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_energy_field.h)

## api_hrtf.cpp

- hrtf 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
-  [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_hrtf.cpp)

## api_hrtf.h 

- hrtf wrapper의 interface, 설정, 상태 및 handle 선언을 제공한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_hrtf.h)

## api_impulse_response.cpp 

- impulse response 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_impulse_response.cpp)
## api_impulse_response.h 

- impulse response wrapper의 interface, 설정, 상태 및 handle 선언
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_impulse_response.h)
## api_opencl_device.cpp 

- opencl device device API의 생성과 리소스 수명을 내부 backend 객체에 연결
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_opencl_device.cpp)

## api_opencl_device.h 

- opencl device wrapper의 interface, 설정, 상태 및 handle 선언
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_opencl_device.h)
## api_probes.cpp 

- probes 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_probes.cpp)

## api_probes.h 

- probes wrapper의 interface, 설정, 상태 및 handle 선언
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_probes.h)

## api_radeonrays_device.cpp 

- radeonrays device device API의 생성과 리소스 수명을 내부 backend 객체에 연결
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_radeonrays_device.cpp)

## api_radeonrays_device.h 

- radeonrays device wrapper의 interface, 설정, 상태 및 handle 선언을 제공
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_radeonrays_device.h)
- reconstructor 데이터 객체의 public C API와 내부 객체/handle 간 변환 및 수명 관리



## api_reconstructor.h 

- api_tan_device.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_tan_device.cpp)
	- reconstructor wrapper의 interface, 설정, 상태 및 handle 선언을 제공


	- tan device device API의 생성과 리소스 수명을 내부 backend 객체에 연결
- api_tan_device.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_tan_device.h)
	- tan device wrapper의 interface, 설정, 상태 및 handle 선언을 제공한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_reconstructor.h)