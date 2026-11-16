---
title: Steam Audio 분석
author: KurtJang
tags:
  - Blog
date: 2026-03-24
draft: "true"
description: Steam Audio 요약
---

---

들여쓰기

<details> <summary>여기를 클릭해서 내용을 확인하세요 (제목)</summary> <div markdown="1">
    
    이곳에 펼쳐질 내용을 작성합니다.
    - 리스트도 가능하고
    - **굵은 글씨**도 가능합니다.

</div> </details>


# 1. Setup


https://valvesoftware.github.io/steam-audio/#learn-more
https://valvesoftware.github.io/steam-audio/downloads.html

![[Steam Audio-1774324570953.webp]]

![[Steam Audio-1775555142550.webp]]


![[Steam Audio-1775555220385.webp]]








---

# 구조 분석



# Steam Audio Core 완전 분석 가이드

---

## 1. 디렉토리 구조 개요

```
core/
├── CMakeLists.txt              (최상위 빌드 설정)
├── src/
│   ├── core/                   (핵심 엔진 소스 - 라이브러리 본체)
│   ├── test/                   (유닛 테스트 - Catch2)
│   ├── benchmark/              (성능 벤치마크)
│   ├── itest/                  (인터랙티브 테스트 - GUI, PortAudio)
│   └── samples/                (샘플 코드)
├── build/                      (CMake 모듈, 툴체인, 의존성 스크립트)
├── deps/                       (빌드된 외부 라이브러리)
├── deps-build/                 (중간 빌드 산출물)
├── data/                       (HRTF 데이터 등 리소스)
└── step0~5_*.bat               (단계별 빌드 배치파일)
```

---

## 2. 빌드 시스템 (CMakeLists.txt)

```
CMakeLists.txt 실행 흐름
├── OS/CPU 감지
│   └── IPL_OS_WINDOWS, IPL_CPU_X64 등 플래그 설정
├── 옵션 설정
│   ├── IPP (Intel Performance Primitives)
│   ├── Embree (Intel 레이트레이서)
│   ├── RadeonRays (AMD GPU)
│   └── TAN (TrueAudioNext - AMD GPU 컨볼루션)
├── 컴파일러 플래그 설정
│   ├── LTCG (Link-Time Code Generation)
│   ├── AVX/AVX2/AVX512 SIMD 최적화
│   └── static runtime 링크
├── 의존성 찾기
│   ├── find_package(IPP)
│   ├── find_package(Embree)
│   ├── find_package(PFFFT)
│   ├── find_package(MySOFA)
│   └── find_package(FlatBuffers)
└── 서브디렉토리 추가
    ├── src/core
    ├── src/test
    ├── src/benchmark
    └── src/itest
```

**FFT 우선순위:** IPP > FFTS > PFFFT (항상 포함)

---

## 3. 핵심 엔진 레이어 구조

```
┌─────────────────────────────────────────────┐
│         C API 계층 (phonon.h)               │ ← 외부 접근 유일 인터페이스
│   IPLContext, IPLScene, IPLSimulator        │
├─────────────────────────────────────────────┤
│      API 어댑터 (api_*.cpp/h)               │ ← C API ↔ C++ 내부 변환
├─────────────────────────────────────────────┤
│    C++ 내부 구현 (ipl 네임스페이스)          │
│                                             │
│   ├─ Scene (레이트레이싱)                   │
│   │   ├─ Scene (CPU BVH)                   │
│   │   ├─ EmbreeScene (Intel Embree)        │
│   │   └─ RadeonRaysScene (GPU OpenCL)      │
│   │                                         │
│   ├─ Simulator (물리 시뮬레이션)            │
│   │   ├─ DirectSimulator                   │
│   │   ├─ ReflectionSimulator               │
│   │   ├─ PathSimulator                     │
│   │   └─ SimulationManager                 │
│   │                                         │
│   └─ Effects (오디오 이펙트 체인)           │
│       ├─ DirectEffect                      │
│       ├─ BinauralEffect (HRTF)             │
│       ├─ IndirectEffect (컨볼루션)         │
│       ├─ ReverbEffect (파라메트릭)         │
│       ├─ HybridReverbEffect                │
│       └─ AmbisonicsEffect (앰비소닉스)     │
│                                             │
├─────────────────────────────────────────────┤
│   기반 유틸리티                              │
│   ├─ Math (벡터, 행렬, 쿼터니언)            │
│   ├─ Memory (정렬 할당자)                   │
│   ├─ FFT (추상 인터페이스)                  │
│   ├─ SIMD (SSE2~AVX512)                    │
│   └─ Threading (JobGraph, ThreadPool)      │
└─────────────────────────────────────────────┘
```

---

## 4. 핵심 서브시스템 상세

### A. Context (진입점)

```
Context 역할
├── 전역 상태 관리
│   ├─ sLog (로그 콜백)
│   ├─ sMemory (커스텀 할당자)
│   └─ sSIMDLevel (SSE2/SSE4/AVX/AVX2/AVX512 선택)
├── 레퍼런스 카운팅
│   ├─ Retain() (+1)
│   └─ Release() (-1)
└── 모든 IPL 객체의 수명 관리
```

**파일:** `context.h`, `context.cpp`, `api_context.cpp`

---

### B. Scene & Ray Tracing

```
IScene (추상 인터페이스)
├── Scene (순수 CPU BVH - 내장 레이트레이서)
├── EmbreeScene (Intel Embree 기반 - 고성능)
└── RadeonRaysScene (AMD GPU OpenCL)

씬 구성
├── StaticMesh (고정 지오메트리)
│   ├── 삼각형 배열
│   ├── 머티리얼 인덱스
│   └── BVH (Bounding Volume Hierarchy)
├── InstancedMesh (복사 인스턴스)
│   ├── 참조 StaticMesh
│   ├── 변환 행렬
│   └── 머티리얼 오버라이드
└── Commit 시 BVH 재빌드

핵심 쿼리
├── closestHit() (최단 히트 정보)
├── anyHit() (하나라도 히트됐는지 - 오클루전 체크)
└── version (BVH 버전 넘버)
```

**파일:** `scene.h`, `scene.cpp`, `bvh.h`, `bvh.cpp`, `embree_scene.h`, `radeonrays_scene.h`

---

### C. Simulation (물리 음향 시뮬레이션)

```
SimulationManager
├── DirectSimulator
│   └── 직접음 계산
│       ├─ 거리감쇠
│       ├─ 공기흡수 (3밴드 EQ)
│       ├─ 지향성 (Directivity)
│       ├─ 차폐 (Occlusion: Raycast/Volumetric)
│       └─ 벽 투과 (Transmission)
│
├── ReflectionSimulator
│   └── 반사음 계산 (몬테카를로 경로추적)
│       ├─ 레이 발사 (numRays개)
│       ├─ 히트 계산 (trace → shade → bounce)
│       ├─ EnergyField 생성
│       │   ├─ [채널수][주파수밴드][시간빈]
│       │   └─ SH 채널 (order=1: 4ch, order=2: 9ch)
│       ├─ ImpulseResponse 재구성
│       └─ OverlapSaveFIR로 FFT 파티션
│
├── PathSimulator
│   └── 경로 탐색 (프로브 기반)
│
└── ThreadPool + JobGraph
    └── 병렬 처리
```

**파일:** `simulation_manager.h`, `direct_simulator.h`, `reflection_simulator.h`, `path_simulator.h`

---

### D. Effects (오디오 이펙트 체인)

```
DirectEffect (직접음)
├── EQEffect (3밴드 IIR)
│   └── 공기흡수 + 벽 투과 적용
└── GainEffect
    └── 거리감쇠 × 지향성 × 차폐 보간

BinauralEffect (공간화)
├── HRTF 로드
├── 방향 보간 (NearestNeighbor or Bilinear)
└── OverlapAdd 컨볼루션
    └── Mono → Stereo (L/R)

IndirectEffect (반사음)
├── Convolution 모드
│   └── OverlapSaveConvolutionEffect (FFT 컨볼루션)
├── Parametric 모드
│   └── ReverbEffect (RT60 기반 IIR)
├── Hybrid 모드
│   ├─ 초기반사 (~100ms): Convolution
│   ├─ 후기잔향 (100ms~): Parametric
│   └─ crossfade 연결
└── TrueAudioNext 모드
    └── GPU OpenCL 컨볼루션

PanningEffect (스피커 패닝)
├── 스피커 레이아웃 정의
└── 5.1 / 7.1 / Stereo 등 채널 매핑

AmbisonicsEffect
├── AmbisonicsEncodeEffect (Mono → SH)
├── AmbisonicsRotateEffect (리스너 방향 회전)
├── AmbisonicsBinauralEffect (SH → Stereo 헤드폰)
└── AmbisonicsPanningEffect (SH → N채널 스피커)
```

**파일:** `direct_effect.h`, `binaural_effect.h`, `indirect_effect.h`, `reverb_effect.h`, `hybrid_reverb_effect.h`, `ambisonics_*.h`

---

### E. HRTF (Head-Related Transfer Function)

```
HRTF 시스템
├── 내장 HRTF (CIPIC 데이터셋)
│   └── cipic_124.inl (소스 내장)
├── SOFA 파일 로드
│   └── libmysofa 사용
├── HRTFDatabase
│   └── 방향별 L/R 임펄스 응답 저장
└── HRTFMap
    ├─ NearestNeighbor 보간 (가장 가까운 방향 선택)
    └─ Bilinear 보간 (인접 4방향 보간)
```

**파일:** `hrtf_database.h`, `hrtf_map.h`, `sofa_hrtf_map.h`, `cipic_124.inl`

---

### F. Probe System (사전 계산)

```
Probe 시스템 (베이킹)
├── Probe 배치
│   └── 씬 내에 그리드로 배치
├── ProbeBatch
│   ├─ 프로브 묶음
│   └─ BakedData 맵 (identifier → IBakedData)
├── ProbeTree
│   └── 공간 탐색 트리 (가장 가까운 프로브 빠르게 찾기)
└── 런타임
    ├─ 리스너/소스 위치 주변 프로브 조회
    └─ 보간으로 연속값 계산
```

**파일:** `probe.h`, `probe_batch.h`, `probe_manager.h`, `probe_generator.h`, `probe_tree.h`, `baked_reflection_data.h`

---

### G. AudioBuffer & DSP 기반

```
DSP 시스템
├── AudioBuffer (디인터리브드)
│   └── float* const* data (채널별 포인터 배열)
├── Array (다차원 배열)
│   └── 커스텀 얼라인드 할당
├── FFT (추상 인터페이스)
│   ├─ ipp_fft.cpp (Intel IPP)
│   ├─ pffft_fft.cpp (PFFFT)
│   └─ ffts_fft.cpp (FFTS)
├── IIR (3밴드 EQ)
│   ├─ LowShelf
│   ├─ PeakEQ
│   └─ HighShelf
├── SphericalHarmonics (SH)
│   └── 구면 조화 함수 (앰비소닉스용)
└── OverlapSaveConvolution
    └── 파티션드 컨볼루션 (FFT 블록 처리)
```

**파일:** `audio_buffer.h`, `array.h`, `fft.h`, `iir.h`, `sh.h`, `overlap_save_convolution_effect.h`

---

### H. GPU 가속 백엔드

```
GPU 시스템
├── OpenCL 추상화
│   ├─ opencl_device.h
│   ├─ opencl_buffer.h
│   └─ opencl_kernel.h
├── RadeonRays (GPU 레이트레이싱)
│   ├─ radeonrays_reflection_simulator.h
│   └─ .cl 커널 (몬테카를로 반사)
└── TAN (TrueAudioNext - GPU 컨볼루션)
    ├─ tan_device.h
    └─ tan_convolution_effect.h
```

**파일:** `opencl_*.h`, `radeonrays_reflection_simulator.h`, `tan_device.h`, `tan_convolution_effect.h`

---

## 5. 데이터 직렬화 (FlatBuffers)

```
.fbs 스키마
├── scene.fbs (Scene 정적 메시)
├── probe_batch.fbs (ProbeBatch + Baked 데이터)
├── energy_field.fbs (EnergyField)
├── impulse_response.fbs (ImpulseResponse)
├── mesh.fbs (메시 지오메트리)
├── material.fbs (머티리얼)
├── sphere.fbs (구)
└── vector.fbs (벡터)

↓ 자동 생성

*.fbs.h (C++ 코드)
```

---

## 6. 시그널 체인 전체 흐름

### 6.1 두 개의 스레드

```
게임 엔진
├── [시뮬레이션 스레드]
│   ├─ iplSimulatorRunDirect() (직접음 계산)
│   │   └─ DirectSimulator::simulate()
│   │       ├─ 거리감쇠, 공기흡수, 지향성, 차폐, 투과
│   │       └─ DirectSoundPath 결과
│   ├─ iplSimulatorRunIndirect() (반사음 계산 - 비동기 가능)
│   │   └─ ReflectionSimulator::simulate()
│   │       ├─ 몬테카를로 레이트레이싱
│   │       ├─ EnergyField 생성
│   │       └─ OverlapSaveFIR 파티션
│   └─ TripleBuffer (스레드 경계)
│       └─ write → share swap (atomic, lock-free)
│
└── [오디오 스레드]
    ├─ iplAudioBufferDeinterleave() (인터리브 → 디인터리브)
    ├─ iplDirectEffectApply() (직접음 이펙트)
    │   ├─ EQEffect (3밴드)
    │   └─ GainEffect
    ├─ iplBinauralEffectApply() (공간화)
    │   ├─ HRTF 보간 + 컨볼루션
    │   └─ Mono → Stereo
    │ 또는
    │ iplPanningEffectApply() (스피커 패닝)
    ├─ TripleBuffer (읽기)
    │   └─ share → read swap
    ├─ iplIndirectEffectApply() (반사음 이펙트)
    │   ├─ Overlap-Save 컨볼루션 또는
    │   ├─ Parametric Reverb (IIR) 또는
    │   └─ Hybrid (Conv + IIR)
    ├─ iplAudioBufferInterleave() (디인터리브 → 인터리브)
    └─ [게임 엔진에 반환]
```

### 6.2 직접음 경로 (Direct Path)

```
Audio Source (Mono PCM)
    ↓
[DirectSimulator::simulate()] ← 시뮬레이션 스레드
    ├─ 거리감쇠 (distanceAttenuation)
    ├─ 공기흡수 (airAbsorption[3밴드])
    ├─ 지향성 (directivity)
    ├─ 차폐 (occlusion: Raycast or Volumetric)
    └─ 벽투과 (transmission[3밴드])
    ↓ 결과: DirectSoundPath 구조체
[DirectEffect::apply()] ← 오디오 스레드
    ├─ EQEffect: 3밴드 IIR 필터
    └─ GainEffect: 전체 게인 보간
    ↓
Mono 직접음 완성
    ↓
공간화 선택
    ├─ BinauralEffect
    │   ├─ HRTF 방향 보간
    │   ├─ OverlapAdd 컨볼루션
    │   └─ Mono → Stereo (L/R)
    ├─ PanningEffect
    │   ├─ 스피커 레이아웃 기반
    │   └─ 5.1 / 7.1 / Stereo
    └─ AmbisonicsEncodeEffect
        ├─ 방향 → SH 계수
        └─ Mono → (order+1)^2 채널
```

### 6.3 반사음 경로 (Indirect Path)

```
[ReflectionSimulator::simulate()] ← 시뮬레이션 스레드
    ├─ numRays개 레이 발사 (예: 4096개)
    ↓
[trace() - IScene::closestHit()]
    └─ 히트 지점 계산
    ↓
[shade() - Shadow ray]
    └─ 에너지 기여 (SH계수 × 거리감쇠 × 재질흡수)
    ↓
[bounce() - 확산/정반사]
    └─ 다음 레이 방향 결정
    ↓
numBounces번 반복
    ↓
[EnergyField 생성]
    ├─ 구조: [채널수][주파수밴드][시간빈]
    ├─ 채널: SH채널 (order=1: 4ch, order=2: 9ch)
    └─ 시간빈: 5ms 단위 히스토그램
    ↓
[IReconstructor::reconstruct()]
    └─ EnergyField → 시간축 ImpulseResponse(IR)
    ↓
[OverlapSavePartitioner::partition()]
    └─ IR → frameSize 블록 분할 + FFT 변환
    ↓
[TripleBuffer::commitWriteBuffer()]
    └─ write → share (atomic swap)
    ↓
[오디오 스레드에서 updateReadBuffer()]
    └─ share → read
    ↓
[IndirectEffect::apply()] ← 오디오 스레드
    ├─ Convolution: OverlapSaveConvolution
    │   └─ FFT(dry) × FFT(IR) → IFFT → wet
    ├─ Parametric: ReverbEffect
    │   └─ RT60 기반 IIR 필터
    ├─ Hybrid: 초기반사 + 후기잔향
    │   ├─ 초기반사 (~100ms): Convolution
    │   ├─ 후기잔향 (100ms~): Parametric
    │   └─ crossfade 연결
    └─ TrueAudioNext: GPU OpenCL
    ↓
N채널 반사음 완성
```

### 6.4 최종 믹싱

```
직접음 (Binaural/Panning 적용 후)
    +
반사음 (IndirectMixer::apply() 합산)
    +
경로음 (PathEffect EQ 적용)
    ↓
최종 AudioBuffer 출력
    (Stereo / 5.1 / 7.1 / Ambisonics)
```

---

## 7. TripleBuffer 동작 (스레드 경계)

```
시뮬레이션 스레드          오디오 스레드
    ↓                           ↓
writeBuffer            readBuffer
    ↓                           ↓
commitWriteBuffer()  ← shareBuffer 교환 → updateReadBuffer()
                     (atomic, lock-free)

동작 방식
├─ 시뮬레이션: 새 IR 완성 → write → share swap
├─ 오디오: 다음 프레임에 share → read swap
└─ 절대 같은 버퍼를 동시 접근 하지 않음 → 락 없이 안전
```

---

## 8. Overlap-Save 컨볼루션 동작

```
dry 입력 블록 (frameSize)
    ↓
FFT(dry block)
    ↓
FFT(dry) × FFT(IR 파티션 블록) ← 복소수 곱셈
    ↓
IFFT → wet 블록
    ↓
overlap 처리
    ├─ 현재 블록 출력
    └─ 이전 블록 꼬리 더하기
    ↓
최종 출력 샘플

파티션 이유
└─ IR이 길수록 (예: 2초 = 96000샘플) FFT 비용 ↑
   → 짧은 블록으로 나눠 분산 처리
```

---

## 9. 정확한 시작점

```
API 진입점
├─ 시뮬레이션 스레드 시작
│   └─ iplSimulatorRunDirect() [api_simulator.cpp:174]
│       └─ SimulationManager::simulateDirect()
│
└─ 오디오 신호 시작
    └─ iplAudioBufferDeinterleave() [api_audio_buffer.cpp:84]
        └─ 게임 엔진 인터리브 PCM → Steam Audio 디인터리브 변환
           (진짜 시작점)

오디오 스레드 실행 순서
├─ iplAudioBufferDeinterleave() [api_audio_buffer.cpp:84]
├─ iplDirectEffectApply() [api_direct_effect.cpp:96]
├─ iplBinauralEffectApply() (또는 iplPanningEffectApply())
├─ iplIndirectEffectApply()
└─ iplAudioBufferInterleave() [api_audio_buffer.cpp:73]
    (끝점 - Steam Audio → 게임 엔진)
```

---

## 10. Occlusion/Obstruction 처리

### 10.1 Raycast Occlusion (단순)

```
Listener ──────────── Source
         (레이 1개)
    
결과
├─ 막힘 → occlusion = 0.0 (완전 무음)
└─ 통과 → occlusion = 1.0 (완전 개방)

파일: direct_simulator.cpp:135
```

### 10.2 Volumetric Occlusion (정교함)

```
[생성자 - 딱 한 번]
    ↓
구 내부 샘플 사전 생성
    ├─ Halton 준난수 시퀀스 (균등 분포)
    ├─ 구면 좌표 (phi, theta, r)
    └─ r = cbrtf(uR) (부피 균등)
    ↓
mSphereVolumeSamples[] 저장

[매 프레임 - simulate() 호출]
    ↓
소스 위치에 구 배치 (radius = occlusionRadius)
    ↓
샘플별 2단계 레이캐스트
    ├─ [1단계] 소스 → 샘플 통과?
    │   └─ 통과하면 numValidSamples++
    └─ [2단계] 리스너 → 샘플 보임?
        └─ 보이면 occlusion++
    ↓
occlusion / numValidSamples
    └─ 0.0 ~ 1.0 연속값 반환

결과 비교
├─ Raycast: 0 또는 1 (이진)
│   └─ 성능 낮음, 부분 차폐 불가
└─ Volumetric: 0.0 ~ 1.0 (연속)
    └─ 성능 높음, 부분 차폐 가능

파일: direct_simulator.cpp:152
```

### 10.3 Transmission (벽 투과)

```
Listener ──레이→ [벽A] ──→ [벽B] ──→ Source
         hit1       hit2

양방향 교대 레이캐스트
    ├─ 리스너 → 소스 방향
    └─ 소스 → 리스너 방향

결과 처리
├─ numHits == 1
│   └─ transmission = hit1.material.transmission[3밴드]
└─ numHits >= 2
    └─ transmission = sqrt(hit1 × hit2 × ...)
       (양면 벽 중복 보정)

파일: direct_simulator.cpp:185
```

---

## 11. Volumetric Occlusion 상세 분석

### 11.1 Halton 준난수 수열

```
완전 랜덤의 문제
└─ 편중될 수 있음

Halton 수열의 장점
├─ 고르게 균등 분포
└─ 더 적은 샘플로도 정확

radicalInverse(base, i) 예시
├─ i=1:   base-2 → 1 → 0.5
├─ i=2:   base-2 → 10 → 0.25
├─ i=3:   base-2 → 11 → 0.75
└─ i=4:   base-2 → 100 → 0.125
    (완벽히 균등)

3개 독립 시퀀스
├─ uPhi = radicalInverse(2, i)   → phi 각도
├─ uTheta = radicalInverse(3, i) → theta 각도
└─ uR = radicalInverse(5, i)     → 반지름
```

### 11.2 구 내부 균등 분포

```
그냥 r = uR 사용
└─ 중심에 몰림 (잘못됨)

cbrtf(uR) 사용
└─ 균등하게 분포 (올바름)

이유
└─ 구 내부 부피 요소: dV = r² sin(θ) dr dθ dφ
   r²에 비례 → 바깥쪽이 더 넓음
   → r = uR^(1/3) 보정

파일: sampling.cpp:102
```

---

## 12. ER / LR 동시 생성

### 12.1 전체 흐름

```
SimulationManager::simulateIndirect()
├─ [1단계] simulateRealTimeReflections() :260
│   └─ ReflectionSimulator → EnergyField (ER + LR 원시 데이터)
│
├─ [2단계] reconstructImpulseResponses() :442
│   └─ EnergyField → ImpulseResponse (ER용 컨볼루션 IR)
│
├─ [3단계] estimateReverb() :493
│   └─ EnergyField → Reverb RT60 (LR용 파라메트릭)
│
├─ [4단계] estimateHybridReverb() :529
│   └─ IR + Reverb → IR 수정 (crossfade 합성)
│
└─ [5단계] partitionImpulseResponses() :563
    └─ 합성된 IR → FFT 파티션 → TripleBuffer

파일: simulation_manager.cpp
```

### 12.2 데이터 흐름

```
ReflectionSimulator::simulate()
    ↓
EnergyField [채널][밴드][시간빈]
    ├─ ER 정보 (초기 반사 에너지)
    └─ LR 정보 (후기 잔향 에너지)
    ↓
    ├─ reconstructImpulseResponses()
    │   └─ 시간축 IR (ER 파형)
    │
    └─ estimateReverb()
        └─ RT60 [3밴드]
    ↓
estimateHybridReverb()
    ├─ transitionTime 기점 분석
    ├─ rampStart ~ rampEnd 구간 설정
    ├─ ER 페이드아웃
    ├─ LR 연결 보정
    └─ transitionTime 이후 0으로 지움
       (오디오 스레드의 ReverbEffect가 처리)
    ↓
최종 IR
    ├─ ER 구간: 원본 그대로
    ├─ 크로스페이드: ER → LR 전환
    └─ LR 구간: 0.0
```

### 12.3 IR 시간축 구간 분석

```
IR 샘플 (시간축)

0                rampStart       rampEnd            numSamples
|←──── ER 구간 ────→|←── Crossfade ──→|← LR 구간 (0) →|

[ER 구간]
    └─ 레이트레이싱 결과 IR 원본
       초기 반사 구간 (~100ms)

[크로스페이드 구간]
    ├─ ER 페이드아웃 (sqrt(alpha) 곡선)
    └─ LR 연결 보정
       transitionTime = HybridReverbEffect 시작점

[LR 구간]
    ├─ 모두 0.0으로 지워짐
    └─ 오디오 스레드의 ReverbEffect(IIR)가
       RT60 기반 파라메트릭으로 처리

파일: hybrid_reverb_estimator.cpp:110
```

### 12.4 HybridReverbEffect 오디오 스레드

```
오디오 스레드에서

HybridReverbEffect::apply()
    ├─ OverlapSaveConvolutionEffect
    │   └─ 위 IR (ER + crossfade) 적용
    │       FFT 컨볼루션
    │
    └─ ReverbEffect (IIR)
        ├─ hybridDelay 후 시작
        ├─ hybridEQ 적용
        └─ RT60 기반 지수 감쇠
            (LR 후기 잔향)
```

---

## 13. 학습 우선순위

```
순서대로 공부하기

1단계: 입문 (API 이해)
    ├─ phonon.h (전체 공개 API)
    ├─ context.h (초기화)
    └─ audio_buffer.h (데이터 구조)

2단계: 씬 구성 (지오메트리)
    ├─ scene.h
    ├─ static_mesh.h
    ├─ bvh.h (레이트레이싱 기반)
    └─ ray.h

3단계: 시뮬레이션 (물리 계산)
    ├─ direct_simulator.h
    ├─ reflection_simulator.h
    └─ simulation_manager.h

4단계: 이펙트 처리 (오디오)
    ├─ direct_effect.h
    ├─ binaural_effect.h
    └─ indirect_effect.h

5단계: 고급 (최적화)
    ├─ probe_batch.h (베이킹)
    ├─ energy_field.h
    ├─ gpu 백엔드
    └─ overlap_save_convolution_effect.h
```

---

## 14. 핵심 파일 맵

```
핵심 API 어댑터
├─ api_context.cpp
├─ api_simulator.cpp
├─ api_scene.cpp
├─ api_audio_buffer.cpp
├─ api_direct_effect.cpp
├─ api_binaural_effect.cpp
└─ api_indirect_effect.cpp

핵심 C++ 구현
├─ context.cpp
├─ simulation_manager.cpp
├─ direct_simulator.cpp
├─ reflection_simulator.cpp
├─ direct_effect.cpp
├─ binaural_effect.cpp
├─ indirect_effect.cpp
├─ hybrid_reverb_estimator.cpp
└─ scene.cpp

헤더 (인터페이스)
├─ phonon.h (공개 API)
├─ iplmemory.h (메모리)
├─ ipltypes.h (기본 타입)
└─ math.h (수학)
```

---

## 15. 빌드 순서

```
step0_setup.bat
    └─ 의존성 다운로드 (IPP, Embree, etc)
    ↓
step1_build_dependencies.bat
    └─ 외부 라이브러리 CMake 빌드
    ↓
step2_generate_project.bat
    └─ Steam Audio CMakeLists.txt → Visual Studio 솔루션
    ↓
step3_build_debug.bat
    └─ Debug 빌드
    ↓
step4_build_release.bat
    └─ Release 빌드
    ↓
step5_package.bat
    └─ 배포용 패키지 생성
```

---

## 핵심 요약

|단계|함수|파일|역할|
|---|---|---|---|
|1|DirectSimulator|direct_simulator.cpp|거리감쇠 / 차폐 / 투과|
|2|DirectEffect|direct_effect.cpp|3밴드 EQ + Gain|
|3|BinauralEffect|binaural_effect.cpp|HRTF 공간화|
|4|ReflectionSimulator|reflection_simulator.cpp|몬테카를로 레이|
|5|EnergyField|energy_field.cpp|에너지 히스토그램|
|6|ImpulseResponse|impulse_response.cpp|시간축 IR|
|7|OverlapSavePartitioner|overlap_save_convolution_effect.cpp|FFT 파티션|
|8|TripleBuffer|triple_buffer.h|락-프리 스레드 전달|
|9|IndirectEffect|indirect_effect.cpp|Overlap-Save 컨볼루션|
|10|HybridReverbEffect|hybrid_reverb_effect.cpp|ER + LR 합성|
|11|AmbisonicsDecodeEffect|ambisonics_*.cpp|SH → 출력|


![[Steam Audio-1774540276334.webp]]



---


