---
title: "[Build] Build metadata source files"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "Steam Audio build metadata 파일 링크와 파일별 책임 설명"
---
---
# 1. Introduction

runtime acoustic algorithm이 아닌 version/resource/debugger metadata 파일의
전체 내용을 보존한다. 이 문서는 앞의 상세 API/build 문서에서 설명한 호출 흐름을 
파일 단위 원본으로 확인하는 자료다.
각 파일을 별도 접기 블록으로 제공하고, 블록 안의 [파일 역할] 주석은 문서용 설명이며
나머지는 저장소 원본이다.

> [!info] 버전 고정
> 공식 원본은 Steam Audio v4.8.1 release tag를 기준으로 연결한다. 
> build 관련 개념과 CMake 흐름은 [Build support 분석](./core_build_support.md)에서 확인한다.

# 2. 파일별 원본과 역할

phonon.natvis public API wrapper를 내부 C++ interface와 연결하고 
API 객체의 수명을 관리한다.

## phonon.natvis 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.natvis)


## phonon.rc.in 
## phonon.rc.in 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.rc.in)



## phonon_version.h.in 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon_version.h.in)

---


