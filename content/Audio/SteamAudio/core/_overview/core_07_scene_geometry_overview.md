---
title: "[Core] Scene & Geometry Overview"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-11-12
draft: "False"
description: "Host geometry를 acoustic Scene, mesh, material, ray query, 가속 backend로 연결하는 구조"
---

---

# 1. <strong style="color:#b3f594">Scene</strong>/Geometry 계층의 역할

Simulation은 소리가 지오메트리에서 부딪히거나 막히는지를 알아야 한다. 
`Scene & Geometry` 계층은 Host의 mesh와 acoustic material을 Core가 
query할 수 있는 형태로 저장하고, ray intersection을 제공한다.

```text
Host mesh/component
     │ vertex · triangle · acoustic material
     ▼
IPLStaticMesh / IPLInstancedMesh
     │ add + commit
     ▼
IPLScene / internal IScene
     │ closestHit / anyHit / batched queries
     ▼
BVH / Embree / Radeon Rays / Custom callbacks
     │
     ├─ Direct occlusion / transmission
     ├─ Reflection ray hits
     └─ Probe visibility / path validation
```

Scene은 모든 음향 계산을 자체적으로 수행하지 않는다. 
다양한 Simulator가 공통 geometry query를 호출한다. 

최상위 안내: [[core_00_overview|Core Overview]] ·
<strong style="color:#b3f594">Pathing</strong> 적용 사례: [[core_06_pathing_overview|Pathing Overview]]

---

# 2. Object model

## 2.1 Scene은 geometry container와 query interface다

`IPLScene`/내부 `IScene`은 geometry object를 그룹화하고 ray query를 제공한다. 
Scene create 함수만으로 triangle 데이터가 생기지는 않는다. 
Scene 안에 static mesh 또는 instanced mesh를 만들고 추가해야 한다.

## 2.2 Static Mesh

Static mesh는 생성 후 변하지 않는 triangle mesh를 표현한다. 
설정에는 vertex, triangle index, material array와 triangle별 material index가 들어간다. 
Host가 움직이는 object를 static mesh 하나로 계속 다시 만드는 대신 instance transform이나 
별도 scene update 경로를 고려한다.

## 2.3 Instanced Mesh

Instanced mesh는 다른 Scene에 있는 mesh를 재사용하면서 parent Scene에서 
transform을 적용한다. 반복되는 건물 모듈이나 prop geometry를 복제하는 대신 
공통 geometry와 여러 instance transform을 사용할 수 있다.

## 2.4 Material

Core의 acoustic material은 그래픽스 material과 다른 데이터다. 
반사 시뮬레이션은 대역별 absorption과 scattering 특성을 사용하고,
<strong style="color:#b3f594">occlusion</strong>/transmission은 surface <strong style="color:#b3f594">transmission</strong> 설정을 참조할 수 있다.

```text
triangle i
   │ materialIndices[i]
   ▼
material m
   ├─ absorption[band]
   ├─ transmission[band]
   └─ scattering
```

재질 인덱스가 잘못 연결되면 geometry는 query되더라도 기대한 표면 음향이 나오지 않는다.

---

# 3. Scene data lifecycle과 commit

```text
Create Scene
   │
Create StaticMesh / InstancedMesh
   │
Add mesh to Scene
   │
Update materials/transforms if necessary
   │
iplSceneCommit(scene)
   │
Use Scene for simulator queries
```

Scene 변경 API는 보통 변경 내용을 표시한 뒤 `iplSceneCommit`을 요구한다. 
Commit 이후 geometry acceleration/query data가 갱신되어 Simulation에서 변경 사항을 
사용할 수 있다. `iplSceneCommit`은 오디오 처리마다 호출하는 함수가 아니라, geometry 변경을 
적용하는 경계다.

Scene을 simulator에 연결하거나 ProbeBatch를 simulator에 추가하는 변경은 
별도의 `iplSimulatorCommit` 경계를 가질 수 있다. 두 commit을 혼동하지 않도록 한다. 
자세한 API 구분은 [[core_02_host_c_api_overview#6. 데이터 교환과 갱신 경계|Host C API data lifecycle]]을 참고한다.

---

# 4. Ray query 모델

Scene의 중요한 query는 다음 두 종류다.

| Query | 목적 | 결과 |
|---|---|---|
| `closestHit` | ray에서 가장 먼저 닿는 surface/거리/material 확인 | hit 정보 |
| `anyHit` | ray 구간에 어떤 geometry든 있는지 빠르게 확인 | 가려짐/통과 여부 |

Direct transmission이나 reflection collision처럼 표면의 material이 필요한 경우 closest-hit
성격이 중요하다. 단순 probe visibility나 line-of-sight 판정처럼 hit 유무만 필요한 경우 
any-hit가 더 적합할 수 있다.

BVH는 bounding volume 계층으로 ray가 통과하지 않는 node 전체를 건너뛰어 
triangle 탐색량을 줄인다. 
ray와 triangle intersection, hit record, coordinate transform도 정확성에 영향을 준다.

상세 분석: [[detail/geometry/core_bvh|BVH]], [[detail/geometry/core_mesh|Mesh]], [[detail/system/core_matrix|Matrix/transform]], [[detail/geometry/core_instanced_mesh|Instanced Mesh]]

---

# 5. 구현 backend

Scene의 논리적 API와 실제 <strong style="color:#b3f594">ray tracing</strong> 구현은 분리된다.

| Scene/backend    | 역할                                                  |
| ---------------- | --------------------------------------------------- |
| Built-in/default | Core 내부 기본 geometry/BVH 기반 query 경로                 |
| Embree           | Embree device/scene/mesh 구조를 사용하는 CPU query backend |
| Radeon Rays      | 지원 환경의 OpenCL GPU ray tracing 경로                    |
| Custom scene     | Host가 제공하는 closest-hit/any-hit callback에 query 위임   |

Backend 선택은 Scene settings 및 build/device capability에 따라 다르다.
같은 `IScene` 성격의 interface를 사용하더라도 
memory ownership, commit, callback threading 등 backend 세부 규칙은 다를 수 있다.

### Backend별 구현 파일

<strong style="color:#b3f594">Built-in / default</strong>

- scene_factory.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene_factory.h) / scene_factory.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene_factory.cpp)
- scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.h) / scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.cpp)
- static_mesh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/static_mesh.h) / static_mesh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/static_mesh.cpp)
- instanced_mesh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/instanced_mesh.h) / instanced_mesh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/instanced_mesh.cpp)
- bvh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bvh.h) / bvh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/bvh.cpp)

<strong style="color:#b3f594">Embree</strong>

- embree_device.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_device.h) / embree_device.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_device.cpp)
- embree_scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_scene.h) / embree_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_scene.cpp)
- embree_static_mesh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_static_mesh.h) / embree_static_mesh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_static_mesh.cpp)
- embree_instanced_mesh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_instanced_mesh.h) / embree_instanced_mesh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/embree_instanced_mesh.cpp)

<strong style="color:#b3f594">Radeon Rays / OpenCL</strong>

- radeonrays_device.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_device.h) / radeonrays_device.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_device.cpp)
- radeonrays_scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_scene.h) / radeonrays_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_scene.cpp)
- radeonrays_static_mesh.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_static_mesh.h) / radeonrays_static_mesh.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/radeonrays_static_mesh.cpp)

<strong style="color:#b3f594">Custom scene</strong>

- custom_scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/custom_scene.h) / custom_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/custom_scene.cpp)

<strong style="color:#b3f594">C API와 backend 연결</strong>

- api_scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_scene.h) / api_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_scene.cpp)
- api_embree_device.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_embree_device.h) / api_embree_device.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_embree_device.cpp)
- api_radeonrays_device.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_radeonrays_device.h) / api_radeonrays_device.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_radeonrays_device.cpp)

Factory와 backend 선택 흐름은 [[core_01_architecture_flow#6. Scene과 Ray Tracing|Architecture Flow: Scene / Ray Tracing]]에서 확인한다.

---

# 6. Coordinate space와 instance transform

Host와 Core의 좌표계가 다르면 Scene vertices, instance transform, Source,Listener를 
일관된 규칙으로 변환해야 한다. 
geometry만 변환하고 listener 좌표는 그대로 두면 ray query와 source/listener 거리가 
서로 다른 공간을 기준으로 계산된다.

Instanced mesh transform은 local mesh를 parent Scene의 위치/회전/스케일로 배치한다.
위치 벡터와 normal/direction vector의 transform 규칙은 서로 다르므로 
source orientation과 surface normal을 함께 다룰 때 좌표 수학을 정확히 해야 한다.

개념/코드: [[detail/system/core_matrix|Matrix]], [[detail/geometry/core_instanced_mesh|Instanced Mesh]], [[detail/geometry/core_scene|Scene]]

---

# 7. Serialization과 Scene 변경

Static mesh/scene 구조는 저장·복원될 수 있고 관련 FlatBuffers `.fbs` schema가 있다.
Runtime Scene object와 serialized data는 동일한 것이 아니다. 
Serialize/load API가 바이너리 데이터와 runtime backend object를 연결한다.

- Scene schema: `scene.fbs`
- Static mesh schema: `static_mesh.fbs`
- API 경계: `api_scene.*`, api_geometry.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_geometry.cpp), `api_serialized_object.*`
- 내부 변환/저장: `scene.*`, `static_mesh.*`, `serialized_object.*`

동적 geometry가 바뀌면 적절한 update/commit 규칙으로 Scene과 연결된 Simulator의 상태를
갱신해야 한다. Scene version을 보는 subsystem이 있으면 변경 이후 반사/visibility cache도 
재계산될 수 있다.

---

# 8. 구현 파일을 읽는 순서

1. phonon.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon.h): `IPLSceneSettings`, `IPLStaticMeshSettings`, `IPLMaterial`, Scene/Mesh API
2. phonon_interfaces.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/phonon_interfaces.h): public Scene/Mesh function forwarding
3. api_scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/api_scene.cpp), geometry API 구현: C handles를 API interface로 변환
4. scene.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.h) / scene.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.cpp): 내부 Scene interface와 query 흐름
5. `static_mesh.*`, `instanced_mesh.*`: geometry 데이터와 transform
6. `bvh.*`, `ray.*`, hit.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/hit.h): 기본 ray query implementation
7. `embree_*`, `radeonrays_*`: 대체 backend 구현
8. direct_simulator.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/direct_simulator.cpp), reflection_simulator.cpp [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/reflection_simulator.cpp), path_visibility.cpp
[링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/path_visibility.cpp): Scene query 소비자 확인

---
