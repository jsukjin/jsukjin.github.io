---
title: "[Core] Benchmark 전체 소스 분석"
author: KurtJang
tags: [Blog, "#Programming", "#CPP", "#SteamAudio"]
date: 2026-11-12
draft: "False"
description: "core/src/benchmark 25개 파일과 21개 등록 workload의 코드 구조·입력·측정 의미"
---
---
# 1. 범위와 읽는 방법

이 문서는 `core/src/benchmark`의 현재 소스 전부를 탐색하는 코드 가이드다. 
21개 `benchmark_*.cpp`는 각각 `BENCHMARK(name)`으로 등록된 작업을 수행하며, 
나머지 4개는 실행 harness, precompiled header, build 구성이다. 
개별 workload의 setup과 measurement boundary를 먼저 읽고, 출력 단위가 무엇을 
의미하는지 확인한다.

상위 실행 구조와 실행 방법은 [[core_12_benchmark_overview|Benchmark Overview]]에 있다. 
Benchmark는 correctness test가 아니며, workload마다 반복 횟수와 측정 구간이 다르다.

---
# 2. 실행 harness 파일

phonon_perf.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/phonon_perf.h)는 `BENCHMARK(name)` 매크로, self-registration, registry interface,
output/helper를 선언한다. Static initialization에서 benchmark 이름과 함수 pointer를 연결한다.

phonon_perf.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/phonon_perf.cpp)는 registry, CLI argument dispatch, `all` 순회, text output,
OBJ `v/f` loader, Windows affinity helper를 구현한다. 
`main` 진입부터 `RunBenchmarks` 호출까지 따라가면 실행 흐름이 보인다.

pch.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/pch.h)는 공통 API/Core/표준 라이브러리 include를 묶는다. 
알고리즘보다는 compile dependency를 확인하는 파일이다.

`CMakeLists.txt`는 benchmark target, workload translation unit, Core/<strong style="color:#b3f594">HRTF</strong> link 관계와 
option 조건을 구성한다. 등록 패턴의 요지는 함수 본문이 registry를 직접 찾는 게 아니라 
정적 등록 객체가 이름을 붙인다는 점이다.

``` cpp fold title:phonon_perf.h 등록 패턴
#define BENCHMARK(name) \
    static void benchmark_##name(); \
    SelfRegisteringFunction register_benchmark_##name(#name, benchmark_##name); \
    static void benchmark_##name()
```

각 benchmark 함수 내부에서 workload 생성, 측정, 출력이 이루어진다. 
따라서 공통 harness가 동일한 warm-up, 반복 횟수, 통계량을 강제하지 않는다.

---
# 3. <strong style="color:#b3f594">Spatial audio</strong> 및 <strong style="color:#b3f594">effect</strong> workload

<strong style="color:#b3f594">panning</strong> 
- benchmark_panning.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_panning.cpp). Speaker
- panning effect를 만들고 layout/frame 조건별 PCM block 처리 비용을 기록한다. 
- Effect 생성과 apply 비용 중 어디까지 타이머에 들어가는지 함수 단위로 확인한다.

<strong style="color:#b3f594">binaural</strong> 
- benchmark_binaural.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binaural.cpp). Object-based binaural processing을 입력 format,
  interpolation/blend 등의 설정으로 반복 적용한다. 
- 결과에는 frame 처리 시간, CPU 사용률, 처리 가능한 source 수 관련 지표가 나온다.
- HRTF/SOFA 입력 유무도 실행 결과에 영향을 준다.

<strong style="color:#b3f594">HRTF</strong> 
- benchmark_binauralrenderer.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binauralrenderer.cpp). HRTF 생성/초기화 시간을 비교한다.
- Frame size, HRTF type, normalization 변형을 실행한다. 
  이름은 hrtf지만 audio block의 지속 처리량이 아니라 생성 비용을 측정한다.

<strong style="color:#b3f594">virtualsurround</strong> 
- benchmark_virtualsurround.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_virtualsurround.cpp). 선택한 speaker layout의 virtual surround effect를 
  만들고 오디오를 반복 처리해 CPU 사용률을 산출한다.
- Layout에 따른 channel 수와 작업량 변화를 비교한다.

<strong style="color:#b3f594">ambisonic binaural</strong> 
- benchmark_ambisonicsbinaural.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_ambisonicsbinaural.cpp).
- Ambisonics order와 frame size별 binaural decode 처리량을 측정한다. 
  입력 channel 수가 order에 따라 증가하므로 두 조건을 함께 비교한다.

<strong style="color:#b3f594">ambisonics rotation</strong> 
- benchmark_ambisonicsrotation.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_ambisonicsrotation.cpp).
- Rotation effect 생성 비용과 apply 비용을 따로 출력한다. 
- 생성 측정과 audio block 처리 측정은 서로 다른 타이머 구간으로 해석한다.

<strong style="color:#b3f594">binaural effect</strong> 
- benchmark_binauraleffect.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binauraleffect.cpp). 
- 반복적인 object-based binaural effect 생성 비용을 측정해 effect 객체 초기화 비용을 
  분리한다.
- Audio processing 처리량 benchmark와는 다른 workload다.

<strong style="color:#b3f594">direct sound effect</strong> 
- benchmark_directsoundeffect.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_directsoundeffect.cpp).
- Channel/transmission 관련 설정 조합으로 direct effect를 만들고 입력 buffer에 적용한다.
- 설정 sweep별 출력 단위와 타이머 범위를 확인한다.

<strong style="color:#b3f594">path effect</strong> 
- benchmark_patheffect.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_patheffect.cpp). 
- Path count와 effect 조건을 설정해 path 결과를 오디오에 누적 적용하는 비용을 측정한다.
- PathEffect의 다중 경로 비용을 보여주는 workload다.

관계 개념은 [[Programming/DSP/dsp_audio_buffer_and_block_processing|buffer/block]], [[Programming/DSP/dsp_hrtf_binaural|HRTF]], [[Programming/DSP/dsp_spherical_harmonics_spatial_audio|Ambisonics]]를 먼저 읽는다.

---
# 4. Geometry, graph 및 path workload

<strong style="color:#b3f594">scene</strong> 
- benchmark_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_scene.cpp)는 Sponza geometry를 불러 scene/mesh를 구성하고 
  backend별 scene finalization/build 시간을 비교한다. 
- Scene object 생성과 finalize 구간이 같은지 코드에서 구분한다.

<strong style="color:#b3f594">rayt racer</strong>  
- benchmark_raytracer.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_raytracer.cpp)는 Sponza scene에서 ray count, bounce, source, 
  thread 조건으로 reflection ray simulation을 수행한다.
- Mrays/s는 초당 million rays 처리량을 뜻한다. 
- CPU Phonon, Embree, 사용 가능한 GPU backend 분기가 있다.

<strong style="color:#b3f594">astar</strong> 
- benchmark_astar.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_astar.cpp)는 준비된 graph/probe route에서 A* 탐색을 실행하고 
  thread pool job graph를 처리한다. 
- 그래프 크기와 탐색 횟수를 확인하고, timer가 query만 재는지 job 처리까지 
  포함하는지 구분한다.

<strong style="color:#b3f594">pathing</strong> 
- benchmark_pathing.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_pathing.cpp)는 source/listener 조건에서 probe/path runtime simulation을
  반복한다. 
- Visibility/path data 준비와 runtime search의 경계를 확인해 bake 비용과 섞이지 않게 읽는다.

<strong style="color:#b3f594">pathingbake</strong> 
- benchmark_pathingbake.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_pathingbake.cpp)는 probe visibility/path baked data 생성시간을 측정.
- Probe 구성, scene query, thread 조건, 결과 데이터 크기와 출력 항목을 확인한다.

<strong style="color:#b3f594">probe lookup</strong> 
- benchmark_probelookup.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_probelookup.cpp)는 probe lookup tree를 query하고 lookup mode와
  probe spacing 설정을 비교한다. 
- 코드상 mode는 nearest/all 계열이며 query 대상 수와 설정별 시간 출력을 해석한다.

이어 읽을 문서: 
- [[Programming/Algorithm/algo_AStar_Dijkstra|A*/Dijkstra]]
- [[Programming/Algorithm/algo_ProbeVisibilityGraph|ProbeVisibility Graph]] 
- [[core_07_scene_geometry_overview|Geometryoverview]]
- [[core_06_pathing_overview|Pathing overview]].

# 5. Reflection, <strong style="color:#b3f594">reverb</strong> 및 reconstruction workload

<strong style="color:#b3f594">reflections</strong> 
- benchmark_reflections.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reflections.cpp)는 ray, bounce, source, thread, simulation duration, 
  SH order 조건으로 reflection simulation을 수행한다.
- 각 backend와 job graph 처리 시간을 비교한다.

<strong style="color:#b3f594">reverb</strong> 
- benchmark_reverb.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reverb.cpp)는 Reverb effect의 frame 처리 시간을 재고frame 시간과 
  예상 CPU 사용률을 출력한다. 
- Simulation bake와 분리된 effect 처리 workload다.

<strong style="color:#b3f594">hybrid reverb simulator</strong> 
- benchmark_hybridreverbsimulator.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_hybridreverbsimulator.cpp)는 probe/baked input을 사용하는 
  hybrid reverb simulation을 구성하고 결과 생성 비용을 측정한다.
- Setup, baked data 접근, simulation 반복이 각각 어느 timer 구간에 포함되는지 확인한다.

<strong style="color:#b3f594">reconstruction</strong> 
- benchmark_reconstruction.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reconstruction.cpp)는 reflection EnergyField에서 impulse response를 
  재구성한다. 
- Source 수, duration, SH order, CPU/OpenCL 경로가 workload 조건에 포함된다.

<strong style="color:#b3f594">baking</strong> 
- benchmark_baking.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_baking.cpp)는 ray, diffuse sample, bounce, probe spacing,
   thread/backend 조건을 바꿔 reflection bake를 수행한다. 
- Elapsed time과 serialized baked data 크기를 함께 출력한다.

학습 링크
- [[core_05_reflections_reverb_overview|Reflection/Reverboverview]]
- [[Audio/SteamAudio/core/detail/reflections/core_reflections_reverb_modules|Reflection/Reverb source guide]]
- [[Audio/SteamAudio/core/detail/probes/core_probes_baking|Probe baking]]

---
# 6. <strong style="color:#b3f594">Convolution</strong> workload

<strong style="color:#b3f594">convolution</strong> 
- benchmark_convolution.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_convolution.cpp)는 설정과 backend에 따라 input/IR block 처리 성능측정
- CPU와 선택적으로 활성화할 수 있는 TAN/Radeon Rays 경로가 있다. 
- Block size, IR 길이, 반복 횟수, 출력 단위를 helper 호출에서 확인한다.

관련 기초는 [[Programming/DSP/dsp_fft_and_convolution|FFT와 Convolution]]이다. 
GPU가 켜져 있지 않거나 장치가 없으면 CPU와 동일한 실험으로 간주할 수 없다.

---
# 7. 측정 코드 검토 체크리스트

각 파일에서 아래 순서로 읽는다.

1. `BENCHMARK(name)` 아래의 등록 함수가 어떤 helper를 호출하는지 찾는다.
2. timer 시작 전 생성되는 scene/effect/input을 확인한다. 이 setup 비용은 보통 처리 시간과 
   다른 항목이다.
3. 타이머 시작·정지 사이 반복 횟수와 `threadPool.process(jobGraph)` 포함 여부를 확인한다.
4. 출력 수식이 per-call latency, frame time, CPU usage, throughput, bake elapsed 중 
   무엇인지 단위를 확인한다.
5. backend 및 `#if`/런타임 device 분기를 확인한다. 출력이 없는 비활성 branch를 
   실행됐다고 가정하지 않는다.
6. 데이터 경로가 relative path인지 확인한다. 특히 Sponza OBJ 및 SOFA 파일이 필요한
   benchmark는 working directory/data 배치에 의존한다.

> [!warning] Benchmark 간 수치 비교
> 이 harness는 통계적 반복 측정 정책을 공통 적용하지 않는다. 출력 단위가 같아 보여도 타이머 경계, workload, build/backend, thread
> 설정이 다르면 직접 비교할 수 없다.

---
# 8. 전체 파일 수 대조

- **Harness/build** - **파일 수:** 4 - **파일:** phonon_perf.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/phonon_perf.h), phonon_perf.cpp[링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/phonon_perf.cpp) 
				  pch.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/pch.h)
- `CMakeLists.txt` - **Registered workloads** - **파일 수:** 21 - **파일:** 위 표에 열거한 21개 
- `benchmark_*.cpp` - **합계** - **파일 수:** **25** - **파일:** 현재 `core/src/benchmark` source 파일 전체

이 페이지의 workload 표는 파일명, 등록 이름과 목적을 1:1로 대응한다. 
수정 시 repository의 실제 `BENCHMARK(...)` 등록과 source 목록을 다시 대조한다.


---
# 9. 전체 source code listing

아래는 `core/src/benchmark` 전체 25개 파일의 본문이다. 
각 workload source에는 등록 이름이 보이는 위치에 설명 주석을 추가했고, 
원본 실행 코드는 보존했다.

## benchmark_ambisonicsbinaural.cpp

- 이 파일은 phonon_perf registry에 ambisonicsbinaural workload를 등록한다.
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_ambisonicsbinaural.cpp)

## benchmark_ambisonicsrotation.cpp 

- 이 파일은 phonon_perf registry에 ambisonicsrotation workload를 등록한다.
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_ambisonicsrotation.cpp)

## benchmark_astar.cpp  

- 이 파일은 phonon_perf registry에 astar workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_astar.cpp)

## benchmark_baking.cpp  

- 이 파일은 phonon_perf registry에 baking workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_baking.cpp)

## benchmark_binaural.cpp 

- 이 파일은 phonon_perf registry에 binaural workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binaural.cpp)

## benchmark_binauraleffect.cpp 

- 이 파일은 phonon_perf registry에 binauraleffect workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binauraleffect.cpp) 

## benchmark_binauralrenderer.cpp 

- 이 파일은 phonon_perf registry에 hrtf workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_binauralrenderer.cpp) 

## benchmark_convolution.cpp  

- 이 파일은 phonon_perf registry에 convolution workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_convolution.cpp)

## benchmark_directsoundeffect.cpp  

- 이 파일은 phonon_perf registry에 directsoundeffect workload를 등록한다.
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_directsoundeffect.cpp)



## benchmark_hybridreverbsimulator.cpp 

- 이 파일은 phonon_perf registry에 hybridreverbsimulator workload를 등록한다.
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_hybridreverbsimulator.cpp) 



## benchmark_panning.cpp 

- 이 파일은 phonon_perf registry에 panning workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_panning.cpp) 
-


## benchmark_patheffect.cpp 

- 이 파일은 phonon_perf registry에 patheffect workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_patheffect.cpp) 



## benchmark_pathing.cpp  

- 이 파일은 phonon_perf registry에 pathingbake workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다..
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_pathing.cpp) 

## benchmark_pathingbake.cpp

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_pathingbake.cpp)

## benchmark_probelookup.cpp 

- 이 파일은 phonon_perf registry에 probelookup workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_probelookup.cpp) 
- 
## benchmark_raytracer.cpp

- 이 파일은 phonon_perf registry에 raytracer workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
-  [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_raytracer.cpp) 

## benchmark_reconstruction.cpp 

- 이 파일은 phonon_perf registry에 reconstruction workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reconstruction.cpp) 

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reconstruction.cpp) 

## benchmark_reflections.cpp 

- 이 파일은 phonon_perf registry에 <strong style="color:#b3f594">reflections</strong> workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reflections.cpp) 

## benchmark_reverb.cpp 

- 이 파일은 phonon_perf registry에 reverb workload를 등록한다. 
- 상세 측정 의도와 조건은 위 workload catalog를 참조한다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_reverb.cpp) 
 전체 코드

이 파일은 phonon_perf registry에 scene workload를 등록한다. 상세 측정 의도와 조건은 위 workload
catalog를 참조한다.

<strong style="color:#b3f594">benchmark_virtualsurround.cpp</strong>
- [benchmark_virtualsurround.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_virtualsurround.cpp)

이 파일은 phonon_perf registry에 virtualsurround workload를 등록한다. 상세 측정 의도와 조건은 위
workload catalog를 참조한다.

- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/benchmark_scene.cpp)
<strong style="color:#b3f594">CMakeLists.txt</strong>
- [CMakeLists.txt 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/CMakeLists.txt)

benchmark target, workload source list 및 library link 구성 전체다.

<strong style="color:#b3f594">pch.h</strong>
- [pch.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/pch.h)

benchmark translation unit 공통 include 전체다.

## phonon_perf.cpp 

- CLI dispatch, registration 실행, output과 OBJ helper의 전체 구현이다.
- [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/benchmark/phonon_perf.cpp)

---
