---
title: Untitled
author: KurtJang
tags:
  - Blog
date: 2026-07-14
draft: "true"
description: 요약
---

---

# 1. Export Static Geometry 실행


**FSteamAudioEditorModule::OnExportStaticGeometry**

**FSteamAudioEditorModule:: ExportAllLevels** - Async (wokerthread) - eiditng level이 instanced
level이면 - **FSteamAudioEditorModule::ExportSingleLevel** - 아니면 -
**FSteamAudioEditorModule::ExportStaticGeometryForLevel** 호출 (async)

**SteamAudio::ExportStaticGeometryForLevel (in SteamAudioScene.cpp)** - Async (worker thread) -
workter thread에서 다른 worker thread 호출 - GetActorsForStaticGeometryExport (game
thread)

**GetActorsForStaticGeometryExport (in SteamAudiosCene)** - Async(worker thread) -
TActorIteractor를 활용해서 StaticMeshComponent가 있다면 add - 만약 USteamAudioSetting에서
bExportLandScapeGemoetry가 true이면 - ALandScape를 서치하고 이를 add

**ExportActors (in SteamAudioScene.cpp)** - async (woker thread) - StaticMeshActor 일경우 -
**ExportStaticMeshComponentsForActor** 실행 - Level (ALandScape) 일경우 -  **ExportLandscapeActor**
실행

**ExportStaticMeshComponentsForActor (in SteamAudioScene)** - Actor에서UStaticMesComponent를 모두 찾는다
- loop를 돌면서 Component마다 UStaticMesh를 찾는다 - Valid RenderData가 있다면 **ExportStaticMeshComponent**
실행

**ExportStaticMeshComponent (in SteamAudioScene)** - Vertex - MinLODExport Idx 찾는다 -
FStaticMeshLODResources에 접근하여 FPositionVertexBuffer에 접근 - static의 경우 좌표를 반영한
vertex를 저장 - static mesh의 경우 relative location만 알고 있어서 이를 world로 변환해서 저장 -
dynamic의 경우 그냥 저장하고 나중에 transform을 조정

- Index
	- FIndexArrayView에서 Index 정보 가져옴
	- Index정보를 토대로 IPLTriangle을 만들고 이를 저장

- Material
	- GetMaterialAssetForActor 을 호출
		- FBodyInstance를 찾아서 Setting에 있는 phys랑 대조하고 정보를 저장
		- ExportMaterial 호출
			- String가지고 기존에 집행했던 data에서 매치되는 USteamAudioMaterial 찾는다
			- 여기의 정보를 그대로 등록

**ExportBSPGeometry (in SteamAudioScene.cpp)** - **ExportStaticMeshComponent 와 동일 (index,
triangles) - 다만 구조가 조금 다름

**FSteamAudioManagerInitializeSteamAudio** - game thread - vertexes, indices가 다 준비되면 IPLScene 생성

- <strong style="color:#b3f594">Scene</strong> 생성
	- 다만 Embree나 OpenCL등 맞게 scene이 생성될수 있음

	- <strong style="color:#b3f594">HRTF</strong> initialization - **FSteamAudioManager::InitHRTF**
		- iplHRTFCreate

	- 생성된 IPLScene, IPLContext를 활용해서 수거한 index, vertex, triangles등을 저장
		- 저장때 IPLSerializedObject를 생성해서 저장

- **iplStaticMeshSave** (만약 obj export 할것이 아니면)

	- StaticMesh의 serializeAsRoot (core)
	- StaticMesh안에서 serailze 한이후 commit

- **USteamAudioSerializedObject::SerializeObjectToPackage**
- **ASteamAudioStaticMeshActor** 스폰 (정보를 가지고 있는 Actor)



# 2. <strong style="color:#b3f594">Probe</strong> Volume (Generate Probe)





- IPLStaticMeshSettings 생성
- **iplStaticMeshCreate** 실행
- staticmesh를 serialize 하기 위해 **iplSerializedObjectCreate**
	- serializeObject 생성이후 잘 생성되면 **iplStaticMeshSave**
- **iplStaticMeshSave**
	- StaticMesh의 serializeAsRoot (core)
	- StaticMesh안에서 serailze 한이후 commit

- USteamAudioSerializedObject 에셋생성 (serailzed object랑 fileName 가지고)
- 이후 ASteamAudioStaticMeshActor 생성
	- IPLScene, IPLStaticMesh 보관용 Actor
- 이후 **iplSerializedObjectRelease** 실행
- **iplStaticMeshRelease** 실행


스팀 오디오 phono 파이프라인 & C ABI 구조 정리 스팀 오디오 phonon 파이프라인과 C ABI의 전체 구조는
[[core_02_host_c_api_overview|Host C API Overview]]에서 이어서 본다. 이 문서가 참조하던 `steamaudio_ue_phonon_notes.html`은 현재
workspace에 없어 embed 대신 유지 중인 기술문서로 연결했다.
