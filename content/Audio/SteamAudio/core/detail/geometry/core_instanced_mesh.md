---
title: "[Core] InstancedMesh"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-07-31
draft: "False"
description: "[SteamAudio] Instanced Mesh 분석"
---

---

# 1. Introduction

<strong style="color:#b3f594">InstancedMesh</strong> = **"같은 지오메트리를 여러 위치에 복제해서 쓰기 위한 클래스"**

> [!info] 방식 비교
> 예) door 하나의 <strong style="color:#b3f594">BVH</strong>/Geometry 를 100개의 다른 위치/회전 크기로 배치하고 싶다면?
> - geometry 100번 복제 (X)
>   - 메모리 100배, 빌드시간 100배 이므로 완전 비추
><br>
> - <strong style="color:#80dfff">geometry 1번 / transform 100개 (0)</strong>
>   - local space에서 geo저장 이후 4x4 행렬 하나만 따로 가진다

<strong style="color:#b3f594">Raycast시 반대로 동작함 (주의)</strong> 
- raycast 시 local space를 매번 world space로 매번 변환하지 않음
- <strong style="color:#ffb15b">ray를 역행렬로 local space로 옮겨서 교차 검사 이후 world로 변환</strong> 
- ray는 점 2개 (원점 + 방향)이라 변환이 훨씬 싸다

---

# 2. 구성 요소

## 1. 클래스

<strong style="color:#b3f594">ipl::IInstancedMesh</strong> - 순수가상 인터페이스
<strong style="color:#b3f594">ipl::InstancedMesh</strong> - 실제 구현체

## 2. 멤버 변수

`mSubScene` 
- 실제 geometry가 lcoal space로 저장된 sub <strong style="color:#b3f594">scene</strong> - shared_ptr로 소유권을 잡아 
  sub scene이 먼저 죽는 것을 방지

`mTransform` 
- 4x4 로컬->월드 변환 행렬

`mInverseTransform` 
- 월드->로컬 변환 행렬 - transfom이 바뀔때만 재계산해서 캐싱

`mNumVertices / mNumTriangles`
 - 서브씬 전체 vertex, triangle 개수

`mHasChanged` 
- transform이 마지막 commit 이후 어떤지 체크하는 dirty flag


> [!tip] 왜 normal vector만 다르게 변환하는가?
>
>  - 표면이 비균일(non-uniform)하게 스케일 되면 normal vector를 다른 
>    vector 처럼 변환할 경우 비율이 깨진다
>   
>  - <strong style="color:#b3f594">normal vecctor 행렬 = 변환 행렬의 역행렬 수칙(transpose)</strong>
>    라는 그래픽스 표준공식 사용
>

  ---

# 3. 실전 코드

  ``` cpp
//instanced_mesh.h

class IScene;
class Scene;

class IInstancedMesh
{
public:
    virtual ~IInstancedMesh(){}

    virtual int numVertices() const = 0;
    virtual int numTriangles() const = 0;
    virtual void updateTransfrom(const IScene& scene,
                                 const Matrix4x4f& transform) = 0;

	virtual void commit (const IScene& scene) = 0;
	virtual bool hasChanged() const = 0;
};

class InstancedMesh : IInstancedMesh
{
public:
	InstancedMesh(shared_ptr<Scene> subScene,
			      const Matrix4x4f& transform);

   virtual int numViertices() const override {return mNumVertices;}
   virtual int numTriangles() const override {return mNumTriangles;}
   const Scene& subScene() const {return *mSubScene;}
   const Matrix4x4f& transform() const {return mTrasnform;}

   virtual void updateTransform(const IIscene& scene,
                                const Matrix4x4f& transform) override;

   virtual void commit(const IScene& scene) override;
   virtual bool hasChanged() cosnt override {return mHasChanged;}

   Hit closestHit(const Ray& ray, float minDist, float maxDist) const;
   bool anyHit (const Ray& ray, float minDist, float maxDist) const;

private:
    Ray inverseTransfromRay(const Ray& ray,
                            float& minDist,
                            float& maxDist) const;

    Hit transformHit(const Hit& hit, const Ray& ray) const;

private:
    shared_ptr<Scene> mSubScene;
    Matrix4x4f mTransform;
    Matrix4x4f mInverseTransform;
    int mNumVertices;
    int mNumTriangles;
    bool mHasChanged;
};

//------------------------------------------------------
//------------------------------------------------------
//------------------------------------------------------

//instanced_mesh.cpp

InstancedMesh::InstancedMesh(shared_ptr<Scene> subScene,
                            const Matrix4x4f& transform)
    : mSubScene(std::static_pointer_cast<Scene>(subScene)
    , mTransform(transform)
    , mNumVertices(0)
    , mNumTriangles(0)
    , mHasChanged(false)
{
    //const auto& = shared_ptr<StaticMesh>
    for (const auto& mesh : mSubScene->staticMeshes())
    {
	    auto staticMesh = static_cast<const StaticMesh*>(mesh.get());
	    mNumVertices += staticMesh->numVertices();
	    mNumTriangles += staticMesh->numTriangles();
    }

    //4x4 행렬 연산은 비싼 연산이가 transform이 바뀔때만 update
    //여기서는 캐싱
    inverse(mTransform, mInverseTransform);
}

void InstancedMesh::updateTransform(const IScene& scene,
                                    const Matrix4x4f& transform)
{
	//4x4 행렬 element(16ea) 바이트 단위 비교
    int result = memcmp(transform.elements,
                        mTransform.elements,
                        16 * sizeof(float));
	if (reuslt != 0)
	{
		mHasChanged = true;
	}

	mTransform = transform;
	inverse(mTransform, mInverseTransform);
}

void InstancedMesh::commit(const IScene& scene)
{
	//subScene한테 BVH 리빌드 위임
	//dirty falg로 false로
    mSubScene->commit();
    mhasChanged = false;
}

Hit InstancedMesh::closestHit(const Ray& ray,
                              float minDist,
                              float maxDist) const
{
	//1. world space ray를 local-space로 변환
	//2. subScene의 실제 BVH에 hit 체크 (local-space)
	//3. 결과를 다시 world-space로 변환
    Ray transformRay = inverseTransformRay(ray, minDist, maxDist);
    Hit hit = mSubScene->closestHit(transformRay, minDist, maxDist);
    return trasformHit(hit, transformRay);
}

bool InstancedMesh::anyHit(const Ray& ray,
                           float minDist,
                           float maxDist) const
{
   //위와 동일 anyHit을 돌려줄 Hit이 없는점만 다름
    Ray transformRay = inverseTransformRay(ray, minDist, maxDist);
    return mSubScene->anyHit(transformRay, minDist, maxDist);
}

Ray InstancedMesh::inverseTransformRay(const Ray& ray,
                                      float& minDist,
                                      float& maxDist) const
{
	/*
	 eg) x축으로만 2배 스케일, x 방향으로 10만큼 이동

	 1.Local -> World (mTransfrom)
	 worldX = 2 ** localX + 10
	 WorldY = localY

	 2. World -> Local (mInverseTransform)
	 localX = (worldX - 10) / 2
	 localY = worldY

	 ray.origin = (10,0,0)
	 ray.direction = (1,0,0)
	 minDist = 0 , maxDist = 5

	 ray.PointAtDistance(d)는 그냥 origion + d * direction이니 미리 계산
	 pointAtDistance(0) = (10,0,0)
	 pointAtDistance(1) = (11,0,0)
	 pointAtDistance(5) = (15,0,0)
	*/

    //auto = Vector4f
    auto origin = mInverseTransfrom * Vector4f(ray.origin);
    /*
       Vector4f (ray.origin) = (10,0,0,1) //1이 붙는다
       * localX(10-10) / 2 = 0
       * origin = (0,0,0)

       로컬에서 원점은 (0,0,0)이니 당연하다
    */

    auto start = mInverseTransform *
                 Vector4f(ray.pointAtDistance(minDist));
     minDist = (start - origin).length();
    /*
      start 와 minDist 재계산

      minDistance = 0이라 pointAtDistance(0) = (10,0,0)
      이걸로 역행렬 변환하면 (10 - 10) / 2 = (0,0,0)
      즉 start = origin
      minDist = |start - origin| = |(0,0,0) - (0,0,0)| = 0

    */

    if (maxDist < std::numeric_limist<float>::infinity())
    {
        auto end = mInverseTransform *
                   Vector4f(ray.pointAtDistance(maxDist));

	    maxDist = (end - origin).length();
    }
    /*
     maxDIstance = 5 -> pointAtDist(5) = (15,0,0)

     localX = (15 - 10) / 2 = 2.5
     end = (2.5, 0, 0)

     maxDist = |end - origin| = |(2.5, 0,0) - (0,0,0)| = 2.5

    ** world-space에서는 "5meter 앞까지 검사해줘" 였는데
       local-space에서는 "2.5meter" 로 바뀜 (2배 스케일)

       만약 변환하지 않았으면 local에서 10meter 까지 검사함
    */

    auto p = mInverseTransform * Vector4f(ray.PointAtDistance(1.0f));
    auto direction = Vector3f::unitVector
    (  Vector3f(p[0], p[1], p[2]) -
       Vector3f(origin[0], origin[1], origin[2])};
    /*
     pointAtDsit(1,0) = (11,0,0)
     localX = (11-10) / 2 = 0.5
     p = (0.5, 0,0)

     그다음
     direction = unitVec(p - origin)
               = unitVec((0.5, 0,0) - (0,0,0))
               = unitVec(0.5,0,0) = (1,0,0)

    normalize 전에 (0.5,0,0)인건은 x축 2배 스케일 때문임
    unitVec를 정규화하면 결국 (1,0,0)

    p = (11-10) / 2 = 0.5      //"-10"이 여기 들어있음
    origin = (11-10)/2 = 0     //"-10"이 여기도 들어 있음
    p - origin = 0.5 - 0 = 0.5 //"-10"이 지워짐

    **두점을 각각 변환한다음 -를 하면 이동성분이 두점에 똑같이 들어가 있다가
      뺄셈을 하면서 자동으로 지워지고 "회전 + 스케일" 성분만 남는다
    */

    Ray transformRay;
    transformRay.origin = Vector3f(origin[0], origin[1], origin[2]);
    transformRay.direction = direction;
    /*
     transformRay.origin = (0,0,0)
     transformRay.direction = (1,0,0)
     minDist (재계산) = 0
     maxDist (재계산) = 2.5 // 원래 5였던게 스케일 때문에 절반

     해당 ray, min/maxDist를 가지고 subScene에서 검사를 하게 되면
     local-space에서 정확히 맞아 떨어지는 geometry범위 검사 가능
    */

 return transformRay;

Hit InstancedMesh::transformHit(const Hit& hit,
                                const Ray& ray) const
{
     /*
	 eg) x축으로만 2배 스케일, x 방향으로 10만큼 이동

	 위에서 ray가  다음과 같이 나옴
	 origin = (0,0,0), direction = (1,0,0)

	 mSubScene->closestHit(...)에 넘기고

	 local-space에서 hit.distane = 1.5, hit.normal = (1,1,0) 이
	 나왔다고 가정
	 */

    Hit transformHit = hit;

    if (hit.distance < std::numeric_limits<float>::infinity())
    {
        Transform origin = mTransform * Vector4f(ray.origin);
        Transform HitPoint = mTransform *
                             Vector4f(ray.PointAtDistance(hit.distance));
    }
    /*
      거리 되돌리기

      ray는 파라미터로 들어온 local-space ray(transformRay) 임
      origin, hitPoint계산에쓰는 mTransform은 순방향 (local->World) 행렬
      inversedTransfomRay 에서 사용한 역행렬과 반대방향

      ray.origin = (0,0,0)을 (local-space 에서 world-space로 되롤리려면)
        - worldX = 2 * 0 + 10 = 10
        - origin = (10,0,0)
      ray.pointAtDist(1.5) = 로컬 원점 + 1.5* 로컬방향
      = (0,0,0) + 1.5 * (1,0,0)
      = (1.5, 0, 0)

      이걸 mTransfrom으로 (world-space) 로 되돌리려면
        - worldX = 2 * 1.5 + 10 = 13
        - hitPoint = (13,0,0)
        - transformedHit.distance = |(13,0,0) - (10,0,0)| = 3

     로컬에서는 1.5였는데 월드에서는 3 (정확히 x축 2배)
    */

    Vector4f normal = Vector4f(hit.normal.x(),
	                           hit.normal.y(),
	                           hit.normal.z(),
	                           0.0f);

	Transform transformedNormal = mInverseTrnasform.transposeCopy() *
	                               normal;
   TransformedHit.normal = Vector3f::unitVector(
       Vector3f(transformedNormal[0].
                transformedNormal[1],
                tnrasformedNormal[2]));

    return transfromedHit;
}

  ```


<strong style="color:#b3f594">instanced_mesh.h</strong>
- [instanced_mesh.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/instanced_mesh.h)

<strong style="color:#b3f594">instanced_mesh.cpp</strong>
- [instanced_mesh.cpp 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/instanced_mesh.cpp)

---

