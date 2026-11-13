# KraftonWwise

Wwise Unreal 통합(`Plugins/Wwise`)을 확장하는 Krafton 플러그인.

# 1. Wwise 플러그인 수정 사항 (KRAFTON_WWISE_ENABLE)

KraftonWwise는 `FAkAudioDevice`, `UAkComponent`, `UAkPortalComponent` 등을 **상속/override** 해서 동작한다.
Wwise 원본은 이 클래스들이 `final`이거나 함수가 non-virtual, 멤버가 `private`이라서 그대로는 확장할 수 없다.
그래서 `Plugins/Wwise/Source/AkAudio` 아래에 **`KRAFTON_WWISE_ENABLE` 매크로로 감싼 수정**을 넣어 둔다.

- 기준 버전: Wwise `2025.1.9.9197.4397` (`Wwise.uplugin`)
- 아래 줄 번호는 위 버전 기준이다. 버전이 다르면 어긋나므로 **함수/블록 이름으로 찾을 것**.
- 모든 수정은 `#if KRAFTON_WWISE_ENABLE` ... `#else`(원본) ... `#endif` 형태라서 매크로를 빼면 원본 동작으로 돌아간다.
- Wwise를 업그레이드하면 이 수정이 사라진다. 아래 목록을 보고 다시 적용한다.

## 적용 체크리스트

| # | 파일 (`Plugins/Wwise/Source/AkAudio/` 기준) | 내용 |
|---|---|---|
| 1 | `AkAudio.Build.cs` | 정의 추가 |
| 2 | `Public/AkAudioModule.h`, `Private/AkAudioModule.cpp` | AkAudioDevice 생성 override 훅 |
| 3 | `Public/AkAudioDevice.h`, `Private/AkAudioDevice.cpp` | final 제거, virtual화, protected화, GetAkComponentClass |
| 4 | `Classes/AkComponent.h`, `Private/AkComponent.cpp` | virtual화, ObstructionService 포인터화, 신규 함수 |
| 5 | `Classes/AkAcousticPortal.h`, `Private/AkAcousticPortal.cpp` | UAkPortalComponent virtual화, 시그니처 변경 |
| 6 | `Classes/AkLateReverbComponent.h` | `OnReverbParamsChanged` protected화 |
| 7 | `Classes/AkSurfaceReflectorSetComponent.h` | `SetEnable` virtual, 접근 지정자 |

수정 후 확인: KraftonWwise 모듈이 컴파일되고, 에디터 로그에 `KraftonWwise module CreateAkAudioDeviceOverride.`가 찍히는지 본다.

---

## 1. AkAudio.Build.cs

```csharp
PublicDefinitions.Add("KRAFTON_WWISE_ENABLE=1");   // 파일 끝, 생성자 마지막
```

> `KraftonWwise.Build.cs`에도 같은 정의가 있다. 둘 다 `=1`이어야 한다.
> `#ifdef`가 아니라 `#if`로 검사하므로 값이 `1`이어야 한다.

## 2. AkAudioModule (AkAudioDevice 생성 override)

**Public/AkAudioModule.h** — `bModuleInitialized` 아래 (line ~64)
```cpp
#if KRAFTON_WWISE_ENABLE
	static TFunction<FAkAudioDevice*()> CreateAkAudioDeviceOverride;
#endif
```

**Private/AkAudioModule.cpp** — 정적 멤버 정의, `ActiveDatabaseOperations` 아래 (line ~69)
```cpp
#if KRAFTON_WWISE_ENABLE
TFunction<FAkAudioDevice*()> FAkAudioModule::CreateAkAudioDeviceOverride = nullptr;
#endif
```

**Private/AkAudioModule.cpp** — `AkAudioDevice` 생성부 (line ~678)
```cpp
#if KRAFTON_WWISE_ENABLE
	AkAudioDevice = CreateAkAudioDeviceOverride.IsSet() ? CreateAkAudioDeviceOverride() : nullptr;
#else
	AkAudioDevice = new FAkAudioDevice;
#endif
```
> 주의: KraftonWwise 모듈이 override를 등록하지 않으면 `AkAudioDevice`가 `nullptr`이 된다.
> `KraftonWwise` 플러그인이 `PreEarlyLoadingScreen` 단계에서 로드되어 먼저 등록한다.

## 3. AkAudioDevice

### 3-1. AkAudioDevice.h

**클래스 선언 (line ~96)** — `final` 제거
```cpp
#if KRAFTON_WWISE_ENABLE
class AKAUDIO_API FAkAudioDevice
#else
class AKAUDIO_API FAkAudioDevice final
#endif
```

**소멸자 (line ~106)** — 기존 생성자 `FAkAudioDevice() {}` 아래에 추가
```cpp
#if KRAFTON_WWISE_ENABLE
	virtual ~FAkAudioDevice() {}
#endif
```

**virtual로 바꿀 함수** — 모두 아래 패턴으로 감싼다.
```cpp
#if KRAFTON_WWISE_ENABLE
	virtual bool Init( void );
#else
	bool Init( void );
#endif
```

| 함수 | line |
|---|---|
| `bool Init( void )` | ~115 |
| `bool Update( float DeltaTime )` | ~124 |
| `void Teardown()` | ~136 |
| `AKRESULT SetPortalObstructionAndOcclusion(const UAkPortalComponent*, float, float, bool in_bTransition = false)` | ~1139 |
| `void PortalsNeedRoomUpdate(UWorld* World)` | ~1428 |
| `void RemoveSpatialAudioPortal(UAkPortalComponent*)` | ~1442 |
| `void AddDefaultListener(UAkComponent*)` | ~1456 |
| `void RemoveDefaultListener(UAkComponent*)` | ~1456 |
| `void UpdateDefaultActiveListeners()` | ~1456 |
| `bool SetSpatialAudioListener(UAkComponent*)` | ~1471 |
| `void GetObsOccServicePortalMap(const TWeakObjectPtr<UAkRoomComponent>, const UWorld*, AkObstructionAndOcclusionService::PortalMap&)` | ~1509 |
| `void CleanDefaultListeners()` (아래 protected 항목 참고) | ~1647 |

**시그니처가 바뀌는 함수 (line ~1435)** — `bUseQueue` 인자 추가
```cpp
#if KRAFTON_WWISE_ENABLE
	virtual void SetSpatialAudioPortal(UAkPortalComponent* in_Portal, const bool bUseQueue = false);
#else
	void SetSpatialAudioPortal(UAkPortalComponent* in_Portal);
#endif
```

**private → protected로 바꿀 멤버** — 아래 패턴. 원본 `private:` 영역의 멤버를 `protected:`로 올렸다가 다시 `private:`로 돌린다.
```cpp
#if KRAFTON_WWISE_ENABLE
protected:
	TMap<UWorld*, TArray<TWeakObjectPtr<UAkPortalComponent>>> WorldPortalsMap;
private:
#else
	TMap<UWorld*, TArray<TWeakObjectPtr<UAkPortalComponent>>> WorldPortalsMap;
#endif
```

| 멤버 | line |
|---|---|
| `WorldPortalsMap` | ~1629 |
| `virtual void CleanDefaultListeners()` | ~1647 |
| `static bool m_bSoundEngineInitialized` | ~1655 |
| `UAkComponentSet m_defaultListeners;` `UAkComponent* m_SpatialAudioListener;` | ~1663 |
| `TSet<UWorld*> WorldsInNeedOfPortalRoomsUpdate` | ~1704 |

**신규 함수 (line ~1734)** — `ResourceUnloadFutures` 아래
```cpp
#if KRAFTON_WWISE_ENABLE
	virtual UClass* GetAkComponentClass() const;
#endif
```

### 3-2. AkAudioDevice.cpp

**`GetAkComponentClass` 정의 (line ~4897)** — 파일 끝쪽
```cpp
#if KRAFTON_WWISE_ENABLE
UClass* FAkAudioDevice::GetAkComponentClass() const
{
	return UAkComponent::StaticClass();
}
#endif
```

**`SetSpatialAudioPortal` 정의 시그니처 (line ~2218)**
```cpp
#if KRAFTON_WWISE_ENABLE
void FAkAudioDevice::SetSpatialAudioPortal(UAkPortalComponent* in_Portal, const bool bUseQueue)
#else
void FAkAudioDevice::SetSpatialAudioPortal(UAkPortalComponent* in_Portal)
#endif
```

**`NewObject<UAkComponent>`를 `GetAkComponentClass()`로 생성하도록 변경** — 5곳. Krafton이 만든 하위 컴포넌트(KraftonWwiseAkComponent)로 대체하기 위함이다.

| 위치 | line | 변경 |
|---|---|---|
| `FAkAudioDevice::CreateListener` | ~444 | `const UClass* AkComponentClass = GetAkComponentClass();` 선언 후 `NewObject<UAkComponent>(World->GetWorldSettings(), AkComponentClass, FName(*ComponentName), RF_Transient)` |
| `FAkAudioDevice::SpawnAkComponentAtLocation` (World 있음) | ~2379, ~2385 | 선언 `const UClass* AkComponentClass = GetAkComponentClass();` 후 `NewObject<UAkComponent>(in_World->GetWorldSettings(), AkComponentClass)` |
| 같은 함수 (World 없음) | ~2393 | `NewObject<UAkComponent>(GetTransientPackage(), AkComponentClass)` |
| `FAkAudioDevice::GetAkComponent` | ~4061, ~4067, ~4075 | `FAkAudioDevice* AudioDevice = FAkAudioDevice::Get();` `const UClass* AkComponentClass = AudioDevice ? AudioDevice->GetAkComponentClass() : UAkComponent::StaticClass();` 후 `NewObject<UAkComponent>(Actor, AkComponentClass)` / `(GetTransientPackage(), AkComponentClass)` |
| `FAkAudioDevice::OnActorSpawned` | ~4498 | `const UClass* AkComponentClass = GetAkComponentClass();` 후 `NewObject<UAkComponent>(SpawnedActor, AkComponentClass)` |

패턴 예시:
```cpp
#if KRAFTON_WWISE_ENABLE
		AkComponent = NewObject<UAkComponent>(in_World->GetWorldSettings(), AkComponentClass);
#else
		AkComponent = NewObject<UAkComponent>(in_World->GetWorldSettings());
#endif
```

## 4. UAkComponent

### 4-1. AkComponent.h

| 변경 | line | 내용 |
|---|---|---|
| `SetAutoDestroy` virtual | ~301 | `virtual void SetAutoDestroy(bool in_AutoDestroy) { bAutoDestroy = in_AutoDestroy; }` |
| `UpdateObstructionAndOcclusion` virtual | ~331 | `virtual void UpdateObstructionAndOcclusion();` |
| **`ObstructionService` 값 → 포인터** | ~372 | 아래 참고 |
| `HasMoved` virtual + protected | ~396 | `protected: virtual bool HasMoved(); private:` |
| `UpdateSpriteTexture` protected | ~407 | `protected:` 아래 `#if WITH_EDITORONLY_DATA ... void UpdateSpriteTexture(); #endif` 후 `private:` |
| `CleanListeners` virtual | ~427 | `virtual void CleanListeners();` |
| 신규 `GetNewSoundPosition`, `GetLengthSquared<T, Vector>` | ~440 | 아래 참고 |
| **(`#if` 없음)** `SetOutputBusVolume_Internal` 신규 | ~237 | `virtual void SetOutputBusVolume_Internal(float BusVolume);` |

**ObstructionService (line ~372)** — 값 멤버를 **포인터**로 바꾼다.
```cpp
#if KRAFTON_WWISE_ENABLE
	AkComponentObstructionAndOcclusionService* ObstructionService;
#else
	AkComponentObstructionAndOcclusionService ObstructionService;
#endif
```
> 포인터로 바뀌므로 `.Init/.Tick/.UpdateObstructionAndOcclusion` 호출이 모두 `->`로 바뀐다 (4-2 참고).
> 포인터는 `new`로 만든다. 소멸 처리가 원본에 없다는 점은 확인이 필요하다 (아래 "확인 필요" 참고).

**신규 함수 (line ~440)** — `_DebugDrawDiffraction` 아래
```cpp
#if KRAFTON_WWISE_ENABLE
	AkSoundPosition GetNewSoundPosition() const;

	template <typename T, typename Vector>
	T GetLengthSquared(const Vector& A, const Vector& B)
	{
		const T Dx = (A.X - B.X);
		const T Dy = (A.Y - B.Y);
		const T Dz = (A.Z - B.Z);

		return (Dx * Dx) + (Dy * Dy) + (Dz * Dz);
	}
#endif
```

**`HasMoved` 패턴 (line ~396)** — 원본은 private 구역에서 선언된다.
```cpp
#if KRAFTON_WWISE_ENABLE
protected:
	virtual bool HasMoved();
private:
#else
private:
	bool HasMoved();
#endif
```

### 4-2. AkComponent.cpp

**`ObstructionService` 호출을 포인터 + null 체크로** (line ~325, ~635)
```cpp
#if KRAFTON_WWISE_ENABLE
	if (ObstructionService)
	{
		ObstructionService->UpdateObstructionAndOcclusion(ObsOccListenerMap, ObsOccPortalMap, GetPosition(), GetOwner(), GetSpatialAudioRoomID(), GetOcclusionCollisionChannel(), OcclusionRefreshInterval);
	}
#else
	ObstructionService.UpdateObstructionAndOcclusion(...);   // 원본 그대로
#endif
```
Tick 부분(~635)도 같은 방식으로 `ObstructionService->Tick(ObsOccListenerMap, ObsOccPortalMap, GetPosition(), GetOwner(), GetSpatialAudioRoomID(), GetOcclusionCollisionChannel(), DeltaTime, OcclusionRefreshInterval);`

**`ObstructionService` 생성/초기화 (line ~442, ~684)**
```cpp
#if KRAFTON_WWISE_ENABLE
	ObstructionService = new AkComponentObstructionAndOcclusionService;     // ~442에서만 new
	if (AudioDevice && CurrentWorld && ObstructionService)
	{
		ObstructionService->Init(GetAkGameObjectID(), CurrentWorld, OcclusionRefreshInterval, AudioDevice->UsingSpatialAudioRooms(CurrentWorld));
	}
	else
	{
		UE_LOG(LogAkAudio, Warning, TEXT("..."));
	}
#else
	if (AudioDevice && CurrentWorld)
	{
		ObstructionService.Init(...);
	}
#endif
```
- ~442: `new` 후 Init
- ~684: 이미 만들어진 포인터로 Init만 한다 (`new` 없음)

**`SetOutputBusVolume` / `SetOutputBusVolume_Internal` (line ~398, ~415)** — 원본 본문을 `_Internal`로 복사하고, 원래 함수는 `_Internal`을 호출한다.
함수 **정의는 항상 존재**하고 **본문만** `#if`로 감싼다.
```cpp
void UAkComponent::SetOutputBusVolume(float BusVolume)
{
#if KRAFTON_WWISE_ENABLE
	SetOutputBusVolume_Internal(BusVolume);
#else
	SCOPED_AKAUDIO_EVENT(TEXT("UAkComponent::SetOutputBusVolume"));
	FAkAudioDevice * AudioDevice = FAkAudioDevice::Get();
	if (AudioDevice)
	{
		CleanListeners();
		FScopeLock Lock(&ListenerCriticalSection);
		for (auto It = Listeners.CreateIterator(); It; ++It)
		{
			AudioDevice->SetGameObjectOutputBusVolume(this, It->Get(), BusVolume);
		}
	}
#endif
}

void UAkComponent::SetOutputBusVolume_Internal(float BusVolume)
{
#if KRAFTON_WWISE_ENABLE
	SCOPED_AKAUDIO_EVENT(TEXT("UAkComponent::SetOutputBusVolume"));
	FAkAudioDevice * AudioDevice = FAkAudioDevice::Get();
	if (AudioDevice)
	{
		CleanListeners();
		FScopeLock Lock(&ListenerCriticalSection);
		for (auto It = Listeners.CreateIterator(); It; ++It)
		{
			AudioDevice->SetGameObjectOutputBusVolume(this, It->Get(), BusVolume);
		}
	}
#endif
}
```
> 선언(`AkComponent.h`의 `virtual void SetOutputBusVolume_Internal`)은 `#if`가 없으므로 매크로가 꺼져도 정의가 있어야 컴파일된다.

**`GetNewSoundPosition` 정의 (line ~1066)** — 파일 끝쪽
```cpp
#if KRAFTON_WWISE_ENABLE
AkSoundPosition UAkComponent::GetNewSoundPosition() const
{
	AkSoundPosition soundpos;
	FVector Location, Front, Up;
	UAkComponentUtils::GetLocationFrontUp(this, Location, Front, Up);
	FAkAudioDevice::FVectorsToAKWorldTransform(Location, Front, Up, soundpos);

	return soundpos;
}
#endif
```

## 5. UAkPortalComponent / AAkAcousticPortal (AkAcousticPortal.h / .cpp)

`UAkPortalComponent`는 `AkAcousticPortal.h`에 있다 (`UAkPortalComponent.h`는 없다).

### 5-1. AkAcousticPortal.h

**`#if` 없이 virtual만 추가 (주석 `//KraftonWwise -> add virtual`)**
```cpp
//KraftonWwise -> add virtual                  (line ~44)
UFUNCTION(BlueprintCallable, Category = "Audiokinetic|AkPortalComponent")
virtual void EnablePortal();

//KraftonWwise -> add virtual                  (line ~51)
UFUNCTION(BlueprintCallable, Category = "Audiokinetic|AkPortalComponent")
virtual void DisablePortal();

///KraftonWwise - add virtual                  (line ~70)
UFUNCTION(BlueprintCallable, Category = "Audiokinetic|AkPortalComponent")
virtual void SetPortalOcclusion(float InPortalOcclusion);
```

**`#if KRAFTON_WWISE_ENABLE`로 감싼 변경**

| 변경 | line | 원본 → 변경 |
|---|---|---|
| `ResetPortalState`, `ResetPortalOcclusion` | ~158 | non-virtual → `virtual` |
| `InitializeParent`, `SetSpatialAudioPortal` | ~208 | `public:` + `virtual void InitializeParent();` + `virtual void SetSpatialAudioPortal(const bool bUseQueue = false);` 후 `private:` (원본은 인자 없음) |
| `UpdateConnectedRooms`, `UpdatePortalConnections` | ~218 | `protected:` + `virtual bool UpdateConnectedRooms();` (**반환형 void → bool**) + `virtual void UpdatePortalConnections();` 후 `private:` |
| `FindConnectedComponents` 아래 | ~231 | `protected:` 만 추가 (아래 멤버들을 protected로) |
| `PortalObstruction` 아래 | ~260 | `private:` 로 복귀 |
| `HandleObjectsReplaced` | ~267 | `protected:` + `virtual void HandleObjectsReplaced(...)` 후 `private:` |
| `InitializeDrawComponent` | ~277 | `protected:` + `virtual void InitializeDrawComponent();` 후 `private:` |
| `UpdateTextVisibility`, `UpdateTextLocRotVis`, `bWasSelected` | ~291 | `protected:`로 올렸다가 `private:` 복귀 |

> 경계가 되는 `#if`가 `protected:` 로 열고 다른 `#if`가 `private:` 로 닫는 구조라서, **블록 순서가 어긋나면 접근 지정자가 꼬인다**. 위 순서대로 적용한다.

### 5-2. AkAcousticPortal.cpp

```cpp
// line ~323  SetSpatialAudioPortal 정의
#if KRAFTON_WWISE_ENABLE
void UAkPortalComponent::SetSpatialAudioPortal(const bool bUseQueue)
#else
void UAkPortalComponent::SetSpatialAudioPortal()
#endif

// line ~554  UpdateConnectedRooms 정의 (반환형 변경)
#if KRAFTON_WWISE_ENABLE
bool UAkPortalComponent::UpdateConnectedRooms()
#else
void UAkPortalComponent::UpdateConnectedRooms()
#endif

// line ~608  UpdateConnectedRooms 끝에서 반환
	bPortalRoomsNeedUpdate = false;
#if KRAFTON_WWISE_ENABLE
	return bRoomsChanged;
#endif
```
> `UpdateConnectedRooms` 안의 `bool bRoomsChanged` 지역 변수(line ~579)를 그대로 반환한다.
> 함수 중간에 `return;`이 있으면 `bool` 반환으로 바꿔야 한다.

## 6. UAkLateReverbComponent (Classes/AkLateReverbComponent.h, line ~167)

`ReverbParamsChanged` 멤버 아래에 추가
```cpp
#if KRAFTON_WWISE_ENABLE
protected:
	void OnReverbParamsChanged();
private:

#endif
```
> 이 블록에는 `#else`가 없다. 현재 파일에서 `OnReverbParamsChanged()` 선언은 이 한 곳뿐이라서 **매크로를 끄면 선언이 사라져 `.cpp`(line ~917 정의)가 컴파일되지 않는다.**
> 원본 Wwise에서는 이 함수가 원래 `private:` 영역에 선언돼 있을 것이므로, 업그레이드 시에는 **원본 선언을 지우고 이 블록으로 옮긴다**(또는 `#else`에 원본 선언을 넣어 매크로 off도 컴파일되게 한다).

## 7. UAkSurfaceReflectorSetComponent (Classes/AkSurfaceReflectorSetComponent.h)

**`#if` 없이 virtual 추가 (line ~62, 주석 `//KRAFTON_WWISE_ENABLE - add virtual`)**
```cpp
UFUNCTION(BlueprintSetter, Category = "Audiokinetic|AkSurfaceReflectorSet")
virtual void SetEnable(bool bInEnable);
```

**접근 지정자 (line ~225)** — `ComputeAcousticPolySurfaceArea()` 아래
```cpp
#if KRAFTON_WWISE_ENABLE
protected:
#else
private:
#endif

	virtual bool ShouldSendGeometry() const override;
	void InitializeParentBrush(bool fromTick = false);
```

---

## 확인 필요 / 알려진 한계

- **이 목록은 `KRAFTON_WWISE_ENABLE` 매크로와 `KraftonWwise` 주석이 붙은 곳만 포함한다.** Wwise 원본과 diff를 뜬 것이 아니다 (폴더가 git 저장소가 아니다). 매크로 없이 조용히 수정한 곳이 있으면 이 문서에 없다. 업그레이드 전에 이전 버전 Wwise와 diff로 한번 더 확인할 것.
  - 단 `SetOutputBusVolume_Internal` 선언처럼 `#if` 없이 추가된 것은 확인된 만큼 위에 적었다.
- `AkComponent.cpp`에서 `ObstructionService`를 `new`로 만드는 곳(line ~443)은 있지만 `delete`는 파일 안에서 찾지 못했다. **메모리 누수 가능성이 있다.** 컴포넌트가 소멸/재초기화될 때(`new`가 다시 호출되는 경로 포함) 해제하는지 점검할 것.
- `AkComponent.cpp` line ~443과 ~686은 둘 다 `ObstructionService`를 `Init`하는데, ~443만 `new`를 한다. ~686이 먼저 호출되면 포인터가 null이라 초기화가 건너뛰어지고 경고 로그만 남는다.
- `AkLateReverbComponent.h`의 `OnReverbParamsChanged` 블록은 `#else`가 없어 매크로 off 시 컴파일되지 않는다 (6번 참고).

---

# 2. 프로젝트별 모듈 설정

`KraftonWwiseSpatialAudio`, `KraftonWwiseAudioService`는 `.uplugin`에서 `LoadingPhase: None`이고, `FKraftonWwiseModule::LoadOptionalModules()`가 로드한다.

사용 여부는 **프로젝트의 `Config/DefaultKraftonWwise.ini`** 에서 정한다 (플러그인 소스는 수정하지 않는다).

```ini
[/Script/KraftonWwise.KraftonWwiseSettings]
ModuleConfig=(bUseOptimization=True,bWithSpatialAudio=True,bWithAudioService=True)
```

- 값은 `UKraftonWwiseSettings::ModuleConfig`(구조체)에 들어 있어서 ini에는 **한 줄**로 저장된다.
- 값이 없으면 `True`.
- `KraftonWwise.Build.cs`가 이 파일을 읽어 `WITH_KRAFTON_WWISE_SPATIAL_AUDIO`, `WITH_KRAFTON_WWISE_AUDIO_SERVICE` 정의를 만든다.
- **컴파일 타임 값이므로 변경 후 재빌드가 필요하다.** (ini를 `ExternalDependencies`로 등록해 두어서, ini가 바뀌면 UBT가 Build.cs를 다시 평가한다.)
- Project Settings → Plugins → KraftonWwise Settings의 Modules 항목에서도 편집할 수 있다 (같은 ini에 저장됨).
- `WITH_KRAFTON_WWISE_DEBUGGER_CATEGORY`는 Shipping/Test가 아닐 때 자동으로 1이 된다.

**`bUseOptimization`은 컴파일 타임 값이 아니다.** 위 두 `bWith*`와 달리 재빌드가 필요 없고 Build.cs도 읽지 않는다.
- `FKraftonWwiseModule::StartupModule()`이 이 값을 `Krafton.Audio.Optimization.Enable` CVar에 넣는다 (`ECVF_SetByProjectSetting`, `KRAFTON_WWISE_ENABLE` 블록 안).
- 오디오 디바이스/컴포넌트가 생성될 때(PIE 시작 시점)부터 읽히므로 런타임에 바꿔도 이미 만들어진 객체에는 반영되지 않는다. 그래서 ImGui에서는 읽기 전용이다.
- 변경 후에는 에디터를 재시작한다. 콘솔 명령으로 CVar를 바꾸면 이 값을 덮어쓴다.
- 값이 없으면 `True` (CVar 코드 기본값 `false`보다 우선한다).

# 3. 모듈 정보

1. KraftonWwiseSpatialAudio
 - AkSpatial audio system 모듈

2. KraftonWwiseAudioService
 - Rtpc share하는 audio service system 모듈

3. KraftonWwiseDebug (구 KraftonWwiseDebuggerCategory)
 - Gameplay Debugger 카테고리, 치트 확장, ImGui 패널 (Shipping/Test 제외)

# 4. Debug 모듈 (KraftonWwiseDebug)

## 4-1. 치트 매니저 확장 (UKraftonWwiseCheatExtension)

`KraftonWwiseDebug` 모듈이 시작되면 `UCheatManager::RegisterForOnCheatManagerCreated`에 등록한다.
치트 매니저가 만들어질 때(이미 있는 것은 즉시) `UKraftonWwiseCheatExtension`이 **없으면 만들어서** 붙인다.

**ImGui 플러그인이 없으면 이 등록 자체를 하지 않는다.** 확장이 조작할 GUI가 없기 때문이다 (`WITH_KRAFTON_WWISE_IMGUI == 0`이면 로그만 남긴다).
ImGui를 대신 설치하거나 활성화하지는 않는다.

| 콘솔 명령 | 동작 |
|---|---|
| `EnableKraftonWwiseImGui 1` / `0` | ImGui 패널 켜기 / 끄기 (`UKraftonWwiseCheatExtension::EnableKraftonWwiseImGui`, `UFUNCTION(Exec)`) |

치트 매니저는 개발 빌드에서만 만들어지고, 이 모듈도 Shipping/Test에서는 로드되지 않는다.

## 4-2. ImGui 패널 (FKraftonWwiseImGuiPanel)

- ImGui 플러그인(`Plugins/ImGui`, [VesCodes/ImGui](https://github.com/VesCodes/ImGui), ImGui 1.92.8)이 **프로젝트에 있을 때만** 빌드된다.
  `KraftonWwiseDebug.Build.cs`가 `Plugins/ImGui/ImGui.uplugin`(한 단계 하위 폴더 포함)을 찾아서 `WITH_KRAFTON_WWISE_IMGUI`를 0/1로 정한다.
  없으면 패널 코드는 빠지고, 명령을 실행하면 경고 로그만 남는다.
- 패널은 확장이 가진 PIE 세션 ID의 ImGui 컨텍스트에 그린다.
- 창의 X 버튼을 누르거나 치트 매니저가 사라지면(PIE 종료) 패널은 꺼진다.

### 구성

제목은 대제목 > 소제목 > 블록 제목 순이다. 내용은 제목보다 들여쓴다.
- 대제목: 크고 굵게, 밝은 파랑 + 밑줄
- 소제목: 조금 작고 굵게, **같은 색을 어둡게** (명도로 대/소 구분)
- 블록 제목: `SeparatorText`

대제목은 **Info**와 **Modules** 두 개다.

| 대제목 | 소제목 | 내용 |
|---|---|---|
| Info | Modules | 모듈 4개의 `Loaded`(초록) / `Not loaded`(빨강) |
| Info | Flags | `WITH_KRAFTON_WWISE_*` 컴파일 플래그 `ON`(초록) / `OFF`(빨강) |
| Modules | KraftonWwise | 블록: AnimNotify (Debug, Footstep Debug), Audio Trigger, Custom Optimization (Listener, 읽기 전용) |
| Modules | Audio Service | 블록: Info(상태, 플래그), Variables |
| Modules | Spatial Audio | 블록: Info(상태, 플래그, Enable 토글), Debug, Queue, Culling |
| Modules | Gameplay Debug Category | 블록: Info, Draw, Audio Service (Gameplay Debugger 창이 무엇을 그릴지 정하는 변수) |
| Modules | Other | 위 어디에도 그려지지 않았지만 등록되어 있는 `Krafton*` CVar (자동 수집, 있을 때만 표시) |

- 토글은 한 줄에 3개(창 폭 600 초과 시 4개)로 배치한다.
- AnimNotify는 `Debug`(`Krafton.Audio.AnimNotify.Debug`)와 `Footstep Debug`(`Krafton.Audio.AnimNotify.Footstep.Debug`)를 **각각** 켜고 끈다. 푸트스텝은 별도 플래그다.
- Custom Optimization (Listener)의 `Krafton.Audio.Optimization.Enable`은 **읽기 전용**(회색)이다. 생성 시점에 읽는 값이라 런타임 변경이 의미가 없고, 툴팁이 `FKraftonWwiseModuleConfig::bUseOptimization`을 바꾸라고 안내한다 (`DrawStaticToggle`).
- Audio Service / Spatial Audio 섹션은 **모듈이 로드되지 않았으면 모든 토글·슬라이더가 비활성**(회색, 조작 불가)이고 빨간 안내문이 나온다. Spatial Audio는 `bWithSpatialAudio=False`(`WITH_KRAFTON_WWISE_SPATIAL_AUDIO=0`)이면 모듈을 로드하지 않아 CVar가 등록되지 않는다. 켜려면 `True`로 바꾸고 재빌드한다.
- 패널 창은 `NoNav | NoFocusOnAppearing`으로 그리고, ImGui 오버레이가 키보드 포커스를 쥐고 있으면 게임 뷰포트로 되돌려 준다 (`ReleaseFocusToGame`). 패널을 켜고 꺼도 게임 입력이 유지된다.
- 슬라이더는 소수 2자리까지 표시한다. 최대값이 작을수록 슬라이더 가로 폭이 짧다 (최대 1이면 90px, 약 3000 이상이면 220px).

### 코드에서 CVar 추가하기

`KraftonWwiseImGuiPanel.cpp`는 표(data table) 없이 그리기 함수에 **CVar 이름을 직접** 넣는다.
CVar 이름 → 값을 가져오고 설정하는 함수가 따로 있다.

```cpp
GetCVar(TEXT("Krafton.Audio.SpatialAudio.Debug.Portal"), bValue);   // bool / int32 / float, 없으면 false
SetCVar(TEXT("Krafton.Audio.SpatialAudio.Debug.Portal"), bValue);

FKraftonWwiseImGuiToggleRow Row(*this, "##Unique");               // 토글 그리드 (3~4열, 별도 파일 KraftonWwiseImGuiToggleRow.h/.cpp)
Row.Toggle(TEXT("Krafton.Audio.SpatialAudio.Debug.Portal"), "Portal");
DrawFloatSlider(TEXT("Krafton.Audio.SpatialAudio.Debug.Interval"), "Interval (s)", 0.1f, 5.f);
DrawIntSlider(TEXT("Krafton.Audio.SpatialAudio.Common.MaxPortalsToProcessPerTick"), "Max Portals / Tick", 1, 500);
DrawStaticToggle(TEXT("Krafton.Audio.Optimization.Enable"), "Enable", "변경 방법 안내");   // 읽기 전용 + 툴팁
```

- 해당 모듈이 로드되지 않아 CVar가 없으면 위젯은 비활성(회색)으로 그려지고, 툴팁에 이유가 나온다. 모듈 단위 비활성은 `FDisabledScope`(`ImGui::BeginDisabled`)로 한 번에 감싼다.
- 패널이 한 번도 그리지 않은 CVar는 `Other`에 자동으로 나온다. 그래서 새 CVar를 추가하고 패널을 고치지 않아도 목록에서 빠지지 않는다.
- `UKraftonWwiseSettings` 값과 이름 필터는 패널에 없다.

> CVar 이름 접두어가 통일되어 있지 않다 (`Kraton.Audio.SpatialAudio.Enable`는 오타, `KraftonWwise.Audio.DebugCategory.ResourceMonitor`는 다른 접두어).
> 이름을 통일하려면 CVar 이름을 바꾸고 이를 쓰는 ini/스크립트도 같이 고쳐야 한다.
