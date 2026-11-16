---
title: "[Core] Scene"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-07-06
draft: "False"
description: "[SteamAudio] scene class 분석 (core module)"
---

---

# 1. Introduction

- `Scene` 은 실제 <strong style="color:#b3f594">Scene</strong> 안의 `StaticMesh` / `InstancedMesh` class를 관리
- <strong style="color:#b3f594">Ray tracing</strong> (closest Hit/ any Hit)을 제공하는 IScene interface의 구현체
- <font color="#b3f594">더블 버퍼 (double-buffer)</font> 패턴으로 "수정중인 Scene" 과 "렌더링 Scene"을 분리


---

# 2. 구성 요소

## 2.1 Iscene (Interface)

- `createStaticMesh()` / `createInstancedMesh`
	- mesh 생성 (Scene에 자동으로 추가되진 않음, 별도 add 필요)
- `addStaticMesh()` / `removeStaticMesh()`
	- scene에 mesh 추가/제거
- `commit()`
	- 변경 사항을 실제로 반영 (vertex swap 시점)
- `version()`
	- `commit` 마다 증가하는 변경 version 번호
- `closestHit()` / `anyHit()`
	- 단일 ray 교차 검사
- `closestHits()` / `anyHits()`
	- 배치(Batch) ray 교차 검사 (<strong style="color:#b3f594">SIMD</strong>/병렬화 대상)
- `isOccluded()`
	- `anyHit` 을 감싼 펴느이 함수 (Interface에 기본 구현 존재)


## 2.2 Scene (구현체)

- `list<shared_ptr<IStaticMesh>> mStaticMeshes[2]`
	- <strong style="color:#ffb15b">double buffer 구현 - 1은 편집용 / 2는 실제 사용</strong> 
	
- `list<shared_ptr<IInstancedMesh>> mInstancedMeshes[2]`
	- 동일
	
- `bool mHasChanged`
	- 마지막 commit 이후 변경 여부 flag
	
- `uint32_t mVersion`
	- 변경 버전 카운터

> [!info] 왜 배열이 2 인가?
> mStaticMeshes(1)
> - addStaticMesh() / removeStaticMEsh()가 여기에 쓴다 (편집용)
>
>mStaticMeshes(0)
>- closestHit() / anyHit() 이 여기서 읽는다 (사용 버퍼)
>
>commit() 호출 시
>- mStaticMeshes(0) = mStaticMeshes(1) //swap 실행
>
>
>

---

# 3. 예제 코드

## 3.1 Double buffer

``` cpp fold title:Steam Audio C++
class DoubleBufferList
{
    //0 = read only , 1 = write
	list<int> mData[2];

	void add (int value)
	{
	    mData[1].push_back(value);
	}

	void commit()
	{
	    mData[0] = mData[1];
	}

	const list<int>& readable() const
	{
	   return mData[0];
	}
}

```


<strong style="color:#b3f594">scene.h</strong>
- [scene.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.h)

<strong style="color:#b3f594">scene.cpp</strong>
- [scene.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene.cpp)

<strong style="color:#b3f594">scene_factory.h</strong>
- [scene_factory.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene_factory.h)

<strong style="color:#b3f594">scene_factory.cpp</strong>
- [scene_factory.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/scene_factory.cpp)

<strong style="color:#b3f594">custom_scene.h</strong>
- [custom_scene.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/custom_scene.h)

<strong style="color:#b3f594">custom_scene.cpp</strong>
- [custom_scene.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/custom_scene.cpp)

---
# 4. 실제 코드


<strong style="color:#b3f594">1. header</strong>

``` cpp fold title:Steam Audio C++
/*
Iscene = Scene에 대한 가상 인터페이스

인터페이스 존재 이유
1. C API 다형성 (type erasure)
 - 실제 구현 (Scene, EmbreeScene)이 뭐든 상관없이 호출 가능하게 하는 다형성
1. DirectSimulator, ReflectionSimulator 를 다른 core module들이
   "구체적으로 어떤 scene인지" 몰라도 되게 하기 위함 (캡슐화)

std::shared_from_this 상속 이유
1. 클래스 내부 (멤버함수)에서 자기 자신의 shared_ptr을 안전하게 없애야 할때
(예 : InstanecedMesh가 subclass을 shared_ptr<IScene>으로 참조해야 하는 경우)
2. this 퐁니터를 직접 shared_ptr로 감싸면 이중 소유권 (double free) 위험이
   있는데 enable_shared_from은 이미 존재하는 shared_tpr 제어 블록을 재사용함
*/

class IScene : public std::enable_shared_from_this<IScene>
{
public:

virtual ~IScene()
{}

virtual int numStaticMeshes() const = 0;

virtual int numInstancedMeshes() const = 0;


//디크스에 저장된 baked data나 Scene cash를 불러올때 사용
//FlatBuffer의 역 직렬화
virtual shared_ptr<IStaticMesh> createStaticMesh(
    int numVertices,
    int numTriangles,
    int numMaterials,
    const Vector3f* vertices,
    const Triangle* triangles,
    const int* materialIndices,
    const Material* materials) = 0;

virtual shared_ptr<IStaticMesh> createStaticMesh(
    SerializedObject& serializedObject) = 0;

virtual shared_ptr<IInstancedMesh> createInstancedMesh(
    shared_ptr<IScene> subScene,
    const Matrix4x4f& transform) = 0;

virtual void addStaticMesh(shared_ptr<IStaticMesh> staticMesh) = 0;

virtual void removeStaticMesh(shared_ptr<IStaticMesh> staticMesh) = 0;

virtual void addInstancedMesh(shared_ptr<IInstancedMesh> instancedMesh) = 0;

virtual void removeInstancedMesh(shared_ptr<IInstancedMesh> instancedMesh) = 0;

/*
편집버퍼(1)의 변경사항을 사용버퍼(0)으로 확정반영하는 시점
*/
virtual void commit() = 0;

// Returns the change version of the scene.
//Every time commit() is called after changing the scene
//(e.g., by adding or removing a static or instanced mesh, or
// by updating the transform of an instanced mesh),
// the version number is incremented.
virtual uint32_t version() const = 0;

virtual Hit closestHit(const Ray& ray,
					   float minDistance,
					   float maxDistance) const = 0;

virtual bool anyHit(const Ray& ray,
					float minDistance,
					float maxDistance) const = 0;

virtual void closestHits(int numRays,
                         const Ray* rays,
                         const float* minDistances,
                         const float* maxDistances,
                         Hit* hits) const = 0;

virtual void anyHits(
    int numRays,
    const Ray* rays,
    const float* minDistances,
    const float* maxDistances,
    bool* occluded) const = 0;

virtual void dumpObj(const string& fileName) const = 0;

virtual void setStaticMeshMaterial(
    IStaticMesh* staticMesh,
    Material* newMaterial,
    int index) = 0;

bool isOccluded(const Vector3f& from,
				const Vector3f& to) const;
};

class Scene : public IScene
{
public:

Scene();

Scene(const Serialized::Scene* serializedObject);

Scene(SerializedObject& serializedObject);

virtual int numStaticMeshes() const override
{
	return static_cast<int>(mStaticMeshes[0].size());
}

virtual int numInstancedMeshes() const override
{
	return static_cast<int>(mInstancedMeshes[0].size());
}

const list<shared_ptr<IStaticMesh>>& staticMeshes() const
{
	return mStaticMeshes[0];
}

const list<shared_ptr<IInstancedMesh>>& instancedMeshes() const
{
	return mInstancedMeshes[1];
}

virtual shared_ptr<IStaticMesh> createStaticMesh(
	int numVertices,
	int numTriangles,
	int numMaterials,
	const Vector3f* vertices,
	const Triangle* triangles,
	const int* materialIndices,
	const Material* materials) override;

virtual shared_ptr<IStaticMesh> createStaticMesh(
	SerializedObject& serializedObject) override;

virtual shared_ptr<IInstancedMesh> createInstancedMesh(
	shared_ptr<IScene> subScene,
	const Matrix4x4f& transform) override;

virtual void addStaticMesh(
    shared_ptr<IStaticMesh> staticMesh) override;

virtual void removeStaticMesh(
    shared_ptr<IStaticMesh> staticMesh) override;

virtual void addInstancedMesh(
    shared_ptr<IInstancedMesh> instancedMesh) override;

virtual void removeInstancedMesh(
    shared_ptr<IInstancedMesh> instancedMesh) override;

virtual void commit() override;

// Returns the change version of the scene.
// Every time commit() is called after changing the scene
// (e.g., by adding or removing a static or instanced mesh,
// or by updating the transform of an instanced mesh),
// the version number is incremented.
virtual uint32_t version() const override;

virtual Hit closestHit(
    const Ray& ray,
    float minDistance,
    float maxDistance) const override;

virtual bool anyHit(
    const Ray& ray,
    float minDistance,
    float maxDistance) const override;

virtual void closestHits(
    int numRays,
    const Ray* rays,
    const float* minDistances,
    const float* maxDistances,
    Hit* hits) const override;

virtual void anyHits(
    int numRays,
    const Ray* rays,
    const float* minDistances,
    const float* maxDistances,
    bool* occluded) const override;

//debug
virtual void dumpObj(const string& fileName) const override;

virtual void setStaticMeshMaterial(
    IStaticMesh* staticMesh,
    Material* newMaterial,
    int index) override;

bool intersectsBox(const Box& box) const;

flatbuffers::Offset<Serialized::Scene> serialize(
    SerializedObject& serializedObject) const;

void serializeAsRoot(
    SerializedObject& serializedObject) const;

private:
 std::list<shared_ptr<IStaticMesh>> mStaticMeshes[2];
 std::list<shared_ptr<IInstancedMesh>> mInstancedMeshes[2];

// Flag indicating whether the scene has changed
// in some way since the previous call to commit().
 bool mHasChanged;

// The change version of the scene.
 uint32_t mVersion;
};


```


<strong style="color:#b3f594">cpp</strong>

``` cpp fold title:Steam Audio C++
#include "scene.h"

#if defined(IPL_OS_WINDOWS)
#include <codecvt>
#endif

namespace ipl {

//--------------------------------
// IScene
//--------------------------------


/*
from -> to 방향으로 ray를 쏴서, 그 사이에 뭔가 막고 있다면 true

계산 분해
direction = unitVector (to - from) : 정규화된 벡터 (길이 1)
maxDist = (to-from).length() -> from 에서 to까지 실제 거리
anyHit(ray, 0.0f, maxDist) -> 0 ~ MaxDist 구간에서 아무 교차나 있으면 true
*/
bool IScene::isOccluded(const Vector3f& from,
                        const Vector3f& to) const
{
    return anyHit(Ray{
       from,
       Vector3f::unitVector(to - from) },
       0.0f,
       (to - from).length());
}


// ----------------------------------------------------
// Scene
// ----------------------------------------------------

Scene::Scene()
    : mHasChanged(false)
    , mVersion(0)
{}

/*
serialzeObjet->static_meshes() : FlatBuffers가 생성한 벡터 접근자
(Serializxed::StaticMesh 배열) */
Scene::Scene(const Serialized::Scene* serializedObject)
    : mHasChanged(false)
    , mVersion(0)
{
    assert(serializedObject);
    assert(serializedObject->static_meshes() &&
    serializedObject->static_meshes()->Length() > 0);

    auto numObjects = serializedObject->static_meshes()->Length();

	//직렬화된 StaticMesh 각각 역직렬화해서 편집버퍼[1] 에 채움
    for (auto i = 0u; i < numObjects; ++i)
    {
        auto staticMesh = ipl::make_shared<StaticMesh>(
            serializedObject->static_meshes()->Get(i));

        mStaticMeshes[1].push_back(
           std::static_pointer_cast<IStaticMesh>(staticMesh));
    }

    mStaticMeshes[0] = mStaticMeshes[1];
}


Scene::Scene(SerializedObject& serializedObject)
    : Scene(Serialized::GetScene(serializedObject.data()))
{}

shared_ptr<IStaticMesh> Scene::createStaticMesh(int numVertices,
                                                int numTriangles,
                                                int numMaterials,
                                                const Vector3f* vertices,
                                                const Triangle* triangles,
                                                const int* materialIndices,
                                                const Material* materials)
{
    auto staticMesh = ipl::make_shared<StaticMesh>(
        numVertices,
        numTriangles,
        numMaterials,
        vertices,
        triangles,
        materialIndices,
        materials);

    return std::static_pointer_cast<IStaticMesh>(staticMesh);
}

shared_ptr<IStaticMesh> Scene::createStaticMesh(
    SerializedObject& serializedObject)
{
    auto staticMesh = ipl::make_shared<StaticMesh>(
        serializedObject);

    return std::static_pointer_cast<IStaticMesh>(staticMesh);
}

shared_ptr<IInstancedMesh> Scene::createInstancedMesh(
    shared_ptr<IScene> subScene,
    const Matrix4x4f& transform)
{
    auto instancedMesh = ipl::make_shared<InstancedMesh>(
        std::static_pointer_cast<Scene>(subScene),
        transform);

    return std::static_pointer_cast<IInstancedMesh>(instancedMesh);
}

/*
mStaticMeshes[1](편집용 버퍼) 에 추가 */
void Scene::addStaticMesh(shared_ptr<IStaticMesh> staticMesh)
{
    mStaticMeshes[1].push_back(staticMesh);

    mHasChanged = true;
}

void Scene::removeStaticMesh(shared_ptr<IStaticMesh> staticMesh)
{
    mStaticMeshes[1].remove(staticMesh);

    mHasChanged = true;
}

void Scene::addInstancedMesh(shared_ptr<IInstancedMesh> instancedMesh)
{
    mInstancedMeshes[1].push_back(instancedMesh);

    mHasChanged = true;
}

void Scene::removeInstancedMesh(shared_ptr<IInstancedMesh> instancedMesh)
{
    mInstancedMeshes[1].remove(instancedMesh);

    mHasChanged = true;
}

/*
처리 순서
1. mHasChanged가 false라도, InstancedMesh중 transfrom이 바뀐거는 true
2. mHasChanged()가 true면 버전(mVersion) 1 증가
3. 편집버퍼[1] 내용을 사용 버퍼[0] 로 복사 (여기서 실제 '반영'이 일어남)
4. 각 InstanceDMesh에 대해 commit() 제귀 호출 (자신의 서브씬 갱신 등)
5. StaticMesh중 "재질 업데이트 대기중"으로 표시된 것들을 실제로 반영(memcpy)
6. mHasChanged false 리셋 (다른 프레임을 위해)
*/
void Scene::commit()
{
    // If no static/instanced meshes have been added or removed
    //since the last commit(), check to see if any
    // instanced meshes have had their transforms updated.
    if (!mHasChanged)
    {
        for (const auto& instancedMesh : mInstancedMeshes[0])
        {
            if (instancedMesh->hasChanged())
            {
                mHasChanged = true;
                break;
            }
        }
    }

    // If something changed in the scene, increment the version.
    if (mHasChanged)
    {
        mVersion++;
    }

    mStaticMeshes[0] = mStaticMeshes[1];
    mInstancedMeshes[0] = mInstancedMeshes[1];

    for (const auto& instancedMesh : mInstancedMeshes[0])
    {
        instancedMesh->commit(*this);
    }

    // Update materials if needed
    for (const auto& staticMesh : mStaticMeshes[0])
    {
        auto phononStaticMesh = static_cast<StaticMesh*>(
            staticMesh.get());

        if (phononStaticMesh->isMarkedToUpdateMaterials())
        {
            memcpy(phononStaticMesh->materials(),
                phononStaticMesh->materialsToUpdate().data(),
                phononStaticMesh->numMaterials() * sizeof(Material));
                phononStaticMesh->unmarkToUpdateMaterials();
        }
    }

    // The scene will be considered unchanged
    //until something is changed subsequently.
    mHasChanged = false;
}

uint32_t Scene::version() const
{
    return mVersion;
}

/*
closestHit
모든 StaticMesh + InstancedMEsh를 순차적으로 검사해서
가장 dist가 작은 Hit을 유지
(순차적 검색이라 오브젝트가 많아지면 비효율적)
*/
Hit Scene::closestHit(const Ray& ray,
                      float minDistance,
                      float maxDistance) const
{
    Hit hit;

    // We sequentially calculate the closest hit of
    // the ray with each scene object,
    // recording the overall closest hit in the scene.
    //If there are many objects
    // in the scene, it would be better to use some
    // sort of acceleration structure.

    for (const auto& staticMesh : mStaticMeshes[0])
    {
        const auto phononStaticMesh = static_cast<const StaticMesh*>(
            staticMesh.get());
        auto objectHit = phononStaticMesh->closestHit(
            ray,
            minDistance,
            maxDistance);

        if (objectHit.distance < hit.distance)
        {
            hit = objectHit;
        }
    }

    for (const auto& instancedMesh : mInstancedMeshes[0])
    {
        const auto phononInstancedMesh = static_cast<const InstancedMesh*>(
            instancedMesh.get());

        auto objectHit = phononInstancedMesh->closestHit(
            ray,
            minDistance,
            maxDistance);

        if (objectHit.distance < hit.distance)
        {
            hit = objectHit;
        }
    }

    return hit;
}

/*
anyHit
occlusion 전용 - 조기 종료
가장 가까운 것을 찾을 필요가 없이 막힌게 하나라도 발견되는 즉시 true
*/
bool Scene::anyHit(const Ray& ray,
                   float minDistance,
                   float maxDistance) const
{
    for (const auto& staticMesh : mStaticMeshes[0])
    {
        const auto phononStaticMesh = static_cast<const StaticMesh*>(
            staticMesh.get());

        if (phononStaticMesh->anyHit(ray, minDistance, maxDistance))
            return true;
    }

    for (const auto& instancedMesh : mInstancedMeshes[0])
    {
        const auto phononInstancedMesh = static_cast<const InstancedMesh*>(
            instancedMesh.get());

        if (phononInstancedMesh->anyHit(ray, minDistance, maxDistance))
            return true;
    }

    return false;
}

void Scene::closestHits(int numRays,
                        const Ray* rays,
                        const float* minDistances,
                        const float* maxDistances,
                        Hit* hits) const
{
    for (auto i = 0; i < numRays; ++i)
    {
        hits[i] = closestHit(rays[i], minDistances[i], maxDistances[i]);
    }
}

void Scene::anyHits(int numRays,
                    const Ray* rays,
                    const float* minDistances,
                    const float* maxDistances,
                    bool* occluded) const
{
    for (auto i = 0; i < numRays; ++i)
    {
        occluded[i] = (maxDistances[i] >= 0.0f) ? anyHit(rays[i], minDistances[i], maxDistances[i]) : true;
    }
}

//AABB 교차 여부
bool Scene::intersectsBox(const Box& box) const
{
    for (const auto& staticMesh : mStaticMeshes[0])
    {
        if (static_cast<const StaticMesh*>(staticMesh.get())->intersectsBox(box))
            return true;
    }

    return false;
}

/*
serialize
각 StaticMesh, FlatBuffers offset으로 직렬화한뒤,
vector로 묶어서 Serialized::scene 테이블 생성
반환값은 "완결된 버퍼"가 아니라 아직 부모 테이블에 포함되기 전의
Offset 일 뿐

*/
flatbuffers::Offset<Serialized::Scene> Scene::serialize(
    SerializedObject& serializedObject) const
{
    //flatBufferBuilder 참조
    auto& fbb = serializedObject.fbb();

    vector<flatbuffers::Offset<Serialized::StaticMesh>> staticMeshOffsets;
    // 미리 용량 확보 (재할당 방지)
    staticMeshOffsets.reserve(numStaticMeshes());

    for (const auto& staticMesh : mStaticMeshes[0])
    {
        staticMeshOffsets.push_back(static_cast<StaticMesh*>(
            staticMesh.get())->serialize(serializedObject));
    }
    auto staticMeshesOffset = fbb.CreateVector(
        staticMeshOffsets.data(), numStaticMeshes());

    return Serialized::CreateScene(fbb, staticMeshesOffset);
}

/*
serializedObject
serialize로 만든 offset fbb.finish()로 확정
이제 파일로 저장 가능한 완전한 버퍼가 됨
serializedObject.commit()로 내부 버퍼 포인터/크기 확정하는 마무리 단계
*/
void Scene::serializeAsRoot(SerializedObject& serializedObject) const
{
    serializedObject.fbb().Finish(serialize(serializedObject));
    serializedObject.commit();
}

/*
dumbObj
디버깅 obj 덤프 파일 생성
steamAudio의 내부 Material(absorption/scattering/transimssion) 표현을
범용 3D 틀에서 알아볼수 있는 OBJ/MTL 포멧으로 변환해서 저장
*/
void Scene::dumpObj(const string& fileName) const
{
    auto utf8fopen = [](const string& fileName)
    {
        //Windows에서는 UTF-8 경로로 UTF-16으로 변환 후
        //_wfopn 사용 (한글 경로 등 지원 목적)
#if defined(IPL_OS_WINDOWS)
        std::string utf8{ fileName.c_str() };
        std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;
        std::wstring utf16{ converter.from_bytes(utf8) };
        return _wfopen(utf16.c_str(), L"w");
#else
        return fopen(fileName.c_str(), "w");
#endif
    };

    auto separatorPos = fileName.find_last_of("/\\");
    auto extensionPos = fileName.find_last_of(".");
    auto baseName = string{
        fileName,
        extensionPos - separatorPos - 1 };

    auto path = string{ fileName, 0, separatorPos + 1 };

    auto mtlFileName = path + baseName + ".mtl";
    auto mtlFile = utf8fopen(mtlFileName);
    fprintf(mtlFile, "# Generated by Steam Audio\n");

    auto objFile = utf8fopen(fileName);
    fprintf(objFile, "# Generated by Steam Audio\n");
    fprintf(objFile, "mtllib %s.mtl\n", baseName.c_str());

    vector<StaticMesh*> staticMeshes;
    vector<Matrix4x4f> transforms;

    for (const auto& staticMesh : mStaticMeshes[0])
    {
        staticMeshes.push_back((StaticMesh*)staticMesh.get());
        transforms.push_back(Matrix4x4f::identityMatrix());
    }

    for (const auto& instancedMesh : mInstancedMeshes[0])
    {
        auto phononInstancedMesh = (InstancedMesh*) instancedMesh.get();

        staticMeshes.push_back(
            (StaticMesh*)phononInstancedMesh->
            subScene().mStaticMeshes[0].front().get());
        transforms.push_back(phononInstancedMesh->transform());
    }

    auto vertexOffset = 1;
    auto materialOffset = 0;

    for (auto i = 0u; i < staticMeshes.size(); ++i)
    {
        const auto & _staticMesh = *staticMeshes[i];

        // The OBJ file format does not use absorption and
        // scattering coefficients; instead it uses diffuse
        // reflectivity (Kd) and specular reflectivity (Ks).
        // They are defined by:
        //
        //  Kd = (1 - absorption) * scattering
        //  Ks = (1 - absorption) * (1 - scattering)
        //
        // To recover these values from the .mtl file,
        // use the following equations:
        //
        //  scattering = Kd / (Kd + Ks)
        //  absorption = 1 - (Kd + Ks)
        //
        // The above equations hold for each band independently.
        // Scattering coefficients will be equal for each
        // band. Transmission coefficients are stored as-is
        // in the transmission filter (Tf) component of the
        // material.
        for (auto k = 0; k < _staticMesh.numMaterials(); ++k)
        {
            const auto materials = _staticMesh.materials();

            float diffuseReflectivity[3] = {};
            float specularReflectivity[3] = {};
            float transmission[3] = {};

            for (auto j = 0; j < 3; ++j)
            {
                diffuseReflectivity[j] = (
                    1.0f - materials[k].absorption[j]) *
                    materials[k].scattering;

                specularReflectivity[j] = (
                    1.0f - materials[k].absorption[j]) *
                    (1.0f - materials[k].scattering);

                transmission[j] = materials[k].transmission[j];
            }

            fprintf(mtlFile, "newmtl material_%d\n", materialOffset + k);

            fprintf(mtlFile,
                "Kd %f %f %f\n",
                diffuseReflectivity[0],
                diffuseReflectivity[1],
                diffuseReflectivity[2]);

            fprintf(mtlFile,
                "Ks %f %f %f\n",
                specularReflectivity[0],
                specularReflectivity[1],
                specularReflectivity[2]);

            fprintf(mtlFile,
                "Tf %f %f %f\n\n",
                transmission[0],
                transmission[1],
                transmission[2]);
        }

        for (auto k = 0; k < _staticMesh.numVertices(); ++k)
        {
            const auto& vertex = _staticMesh.mesh().vertex(k);
            auto transformedVertex = transforms[i] *
            Vector4f(vertex.x(),
                     vertex.y(),
                     vertex.z(), 1.0f);

            fprintf(objFile,
                "v %f %f %f\n",
                transformedVertex.elements[0],
                transformedVertex.elements[1],
                transformedVertex.elements[2]);
        }

        auto previousMaterialIndex = -1;
        for (auto k = 0; k < _staticMesh.numTriangles(); ++k)
        {
            auto materialIndex = _staticMesh.materialIndices()[k];
            if (materialIndex != previousMaterialIndex)
            {
                fprintf(objFile,
                    "usemtl material_%d\n",
                    materialOffset + materialIndex);

                previousMaterialIndex = materialIndex;
            }

            const auto& triangle = _staticMesh.mesh().triangle(k);
            fprintf(objFile,
                "f %d %d %d\n",
                vertexOffset + triangle.indices[0],
                vertexOffset + triangle.indices[1],
                vertexOffset + triangle.indices[2]);
        }

        vertexOffset += _staticMesh.numVertices();
        materialOffset += _staticMesh.numMaterials();
    }

    fclose(mtlFile);
    fclose(objFile);
}

/*
setStaticMeshMaterial
특정 staticMesh의 제질 교체
바로 반영되지 않고 예약(markToUpdateMaertials)로만 해둠
실제 반영은 commit() 에서 memcpy 처리
*/
void Scene::setStaticMeshMaterial(IStaticMesh* staticMesh,
                                  Material* newMaterial,
                                  int index)
{
    auto buildInStaticMesh = reinterpret_cast<StaticMesh*>(staticMesh);

    for (const auto& curStaticMesh : mStaticMeshes[0])
    {
        if (curStaticMesh.get() == buildInStaticMesh)
        {
            *const_cast<Material*>(
            buildInStaticMesh->
            materialsToUpdate().data() + index) = *newMaterial;

            buildInStaticMesh->markToUpdateMaterials();
            break;
        }
    }
}

}



```




---
