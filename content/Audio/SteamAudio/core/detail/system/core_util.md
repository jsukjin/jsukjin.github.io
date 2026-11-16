---
title: "[Core] Util"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - "#SteamAudio"
date: 2026-05-09
draft: "False"
description: "[SteamAudio] util.h [링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/util.h) 분석 (core module)"
---

---

# 1.util.h

- C API Handle (`IPLContext` , `IPLScene` 등) 생명주기를 관리하는 템플릿 유틸리티 모음
- C API의 `void*`  핸들과 내부 C++ 객체 사이의 변환, 레퍼런스 카운팅, 메모리 해제를 담당


<font color="#b3f594">1. Handle&lt;T&gt; - 레퍼런스 카운팅 래퍼</font>

- `shared_ptr<T>` 를 감싸고 `atomic<T>` 로 레퍼런스 카운터를 직접 관리한다 
- `retain()` / `releas()` 로 수명을 제어하며 카운트가 0이 되면 내부 포인터를 해제한다 <br>

<font color="#b3f594">2. Handle&lt;T&gt; - 타입 매핑 테이블</font> 
- `ipl::Context` <-> `IPLContext` 처럼 C++ 타입과 C핸들 타입을 연결하는 특성 구조체 
  `DEFINE_OPAQUE_HANDLE` 매크로로 모든 타입 쌍을 등록한다 

<br> <font color="#b3f594">3.
전역 헬퍼 함수 4개</font> 
- `createHandle` `retainHandle` `releaseHandle` `derefHandle` 로 각각 - 핸들의
  생성/참조/해제/역참조를 처리한다

---
## 1. 구성요소

`Handle<T>`

- `mPointer`
	- 실제 C++ 객체를 담은 `shared_ptr<T>`

- `mRefCount`
	- 원자적 레퍼런스 카운터 - `std::atomic<int>`

- `mContext`
	- 이 핸들을 소유한 Context (Context 핸들 자신은 nullptr)

- `retain()`
	- 레퍼런스 카운트 증가

- `release()` - 카운트 감소 - 0이 되면 `mPointer.reset()` 후 `true` 반환 

- `HandleTraits<T>` - C++ 타입 -> C 핸들 타입 매핑 
- `DEFINE_OPAQUE_HANDLE(IPLContex, Context)` -> `HandleTraits<ipl::Context>::opaque_type 

-  IPLContext createHandle(context, sharedPointer) = 
	gMemory().allocate 로 `Handle<T>` 공간 확보 후 placement new로 생성 

- `retainHandle(handle)` - C 핸들 -> `Handle<T>*` 로 캐스팅 후
- `retain()` 호출 <br>

---

## 2. 예제 코드

``` cpp fold title:Steam Audio C++
// 핸들 생성
IPLContext handle = createHandle(nullptr, ipl::make_shared<Context>(...));

//C핸들 -> C++ 객체 접근
auto ctx = derefHandle<Context>(handle);
//ctx = shared_ptr<Context>

//ref count 증가
retainHandle<Context>(handle);
// mRefCount : 1 -> 2

//해제 (카운트 0 이 되면 메모리 해제)
releaseHandle<Context>(handle);
// mRefCount : 2 -> 1
// handle == 그대로

releaseHandle<Context>(handle);
// mRefCount : 1 -> 0 -> free
// handle == nullptr
```

---

## 3. 실제 코드
``` cpp fold title:Steam Audio C++
template <typename T>
class Handle
{
private:
    shared_ptr<T> mPointer;
    //실제 C++ 객체 (예 : ipl::Context)
    //shared_ptr이므로 Handle 소멸 시 자동 해제

    std::atomic<int> mRefCount;
    // 레퍼런스 카운팅 (atomic이라 multi thread 환경도 안전함)

    shared_ptr<Context> mContext;
    //이 핸들을 만든 Context
    //Context 핸들 자신은 nullptr (부모가 없으므로)

public:
    Handle(shared_ptr<T> pointer, shared_ptr<Context> context)
        : mPointer(pointer)
        , mRefCount(1)
        , mContext(context)
	{}

	Handle(const Handle<T>&) = delete;
	Handle(Handle<T>&) = delete;
	//복사/이동 금지
	// 핸들은 반드시 retainHandle/releaseHandle로만 수명 관리

	void retain()
	{
	    ++mRefCount;
	}

	bool release()
	{
	    if (--mRefCount == 0)
	    {
	        mPointer.reset();
	        // shared_ptr 해제 -> ipl::Context 소멸
	        return true;
	        // 호출자에게 '메모리 해제 가능' 신호
	    }

	    return false;
	}

	shared_ptr<T>& get()
	{
	    return mPointer;
	    //내부 C++ 객체 반환
	    //derefHandle()이 이 함수를 호출
	}

	shared_ptr<Context> context()
	{
	    return mContext;
	    //이 핸들을 소유한 Context 반환
	    //contextFromHandle()이 이걸 호출
	}
}

templae <typename T>
struct HAndleTraits
{
    typedef void opaque_type; //void로 기본값 있음
}

//DEFINE_OPAQUE_TYPE (C타입, C++ 클래스명)
// 두가지 일을 동시에 함
// 1. ipl 네임스페이스에 전방 선언 추가
// 2. HandleTraits 특수화로 타입 매핑 등록

#define DEFINE_OPAQUE_HANDLE(x,y)
	namespace ipl {class y;}          //ipl::Context 전방 선언
    namespace api {
	    template <>
	    struct HandleTraits<ipl::y>   //ipl::Context 특수화
	    {
	        typedef x opaque_type;    //opaque_type = IPLContext
	    };
    }

DEFINE_OPAQUE_HANDLE(IPLContext, Context);
//HandleTraits<ipl::Context>::opaque_type = IPLContext

DEFINE_OPAQUE_HANDLE(IPLSecne, IScene);
//HandleTraits<ipl::IScene>::opaque_type = IPLScene

namespace api
{

//특수 케이스 - TripleBuffer는 매크로로 등록 불가능한 복잡한 타입
template<>
strcut HandleTraits<ipl::TripleBuffer<ipl::OverlapSaveFIR>>
{
    typedef IPLReflectionEffectIR opaque_type;
    //DEFINE_OPAQUE_HANDLE 매크로는 단순 클래스명만 받음
    //템플릿 타입은 직접 특수화로 등록해야 함
}

template <typenaem T>
typename HandleTraits<T>::opaque_type creatEHandle(
    shared_ptr<Context> context,
    shared_ptr<T> sharedPointer)
// 반환 타입이 T에 따라 자동 결정됨
// T = ipl::Context 이면 반환 타입 = IPLContext
{
    Handle<T>* handle = reinterpret_cast<Handle<T>*>(
        gemeory().allocate(sizeof(Handle<T>), Memory::kDefaultAlignement);

    //gMemory() 로 Handle<T> 크리만큼 힙 확보
    //예 : sizeof(Handle<Context>) = 32 바이트

    new (handle) Handle<T>(shared_ptr<T>(sharedPointer), context)
    // placement new로 확보된 공간헤 Handle 생성
    // 생성자 호출 -> mrefCount = 1

    return reinterpret_cast<typename HandleTraits<T>::opaque_type>(handle);
    //Handle<Context>* -> IPLContext (void*) 로 캐스팅
    //외부에는 불투명한 포인터로만 보임
}

/*
 * reinterpret_cast 에서 포인터에 대한 참조를 쓰는 이유?
 *
 * eg)
 * reinterprt_cast<Handle<T>*>(handle)->retain();
 * //handle의 복사본을 캐스팅(원본은 그대로)
 *
 * reinterpret_cast<Handle<T>*&)(handle)->retain();
 * //handle 자체를 캐스팅
 * //원본 handle 변수에 직접 접근
*/

template <typename T>
typename HandleTraits<T>::opaque_type retainHandle (
    typename HandleTraits<T>::opaque_type handle)
{
    if (!handle) return nullptr;

    reinterpret_cast<Handle<T>*&> (handle)->retain();
    //IPLCohntext -> Handle<Context>* 로 캐스팅 후 retain()
    //mRefCount : 1 -> 2

    return handle;
    //같은 핸들 반환 (C API에서 핸들 값은 그대로)
}

template <typename T>
void releaseHandle(typename HandleTraits<T>::opaque_type& handle)
{
    if (!handle) return;

    if (reinterpret_cast<Handle<T>*&>(handle)->release())
    {
        reinterpret_cast<Handle<T>*&>(handle)->~handle();
        //handle 소멸자 호출 -> mPointer.reset() -> ipl::Context 소멸

        gMemory().free(handle);
        //포인터에 대한 참조(*&)로 접근하여서 free가 가능
    }

    handle = nullptr;
    //외부 핸들 변수를 nullptr로 초기화
    //iplContextRelease(&ctx) 후 ctx == nullptr이 되는 이유
}

template <typename T>
shared_ptr<T> derefHandle(typename HandleTraits<T>::opaque_type handle)
{
    if(!handle) rturn nullptr;

    return reinterpret_cast<Handle<T>*&>(handle)->get();
    //IPLContext -> Handle<Context>* -> mPointer 반환
    //반환값 = shared_ptr<ipl::Context>
    //api_context.cpp에서 실제로 Context 객체에 접근할 때 사용
}

template <typename T>
shared_ptr<Context> contextFromHandle(typename HandleTraits<T>::opaque_type handle)
{
    if(!handle) reutrn nullpr;

    return reinterpret_cast<Handle<T>*&>(handle)->context();
    //이 핸들을 소유한 Context 반환
    //예 : IPLScene 핸들 -> 그 Scene을 만든 Context 반환
    //Scene이 Context 보다 오래 살아있지 못하도록 보장하는 용도
}


}// end ofnamespace



```
---

## 4. Q&A

<font color="#b3f594">왜 이렇게 번거롭게 C API 사용해야 하나요?</font>

UE 는 자체 빌드 시스템이 있고 Unity는 C# 기반이라 다른 컴파일러, 다른언어,<br> 다른 런타임 환경에서 작동이 되야 합니다.

**만약 내 Context 클래스를 UE에 그대로 넘기면?**

- 컴파일러가 다르면 클래스 레이아웃이 다를 수 있음
- vtable 구조가 달라질 수 있음
- 네임 스페이스 충돌
- STL 버전 충돌
- 크래쉬 또는 렝크에러

해결 방법은 <font color="#ffa500">C API</font> - C는 모든 언어/컴파일러가 공통으로 이해하는 최소 공통규격 
위의 코드에서 void*는 그냥 메모리 주소라 C++, C#이어도 주소값 이해는 가능

``` cpp fold title:Steam Audio C++
//일반적으로 선언한다
void* handle = iplContextCreate(...);

//이렇게 하면 컴파일러가 막아주지 못함
iplSceneRelease(handle)
//Context 핸들을 Scene 함수에 넘겨도 에러가 없음 (런타임 크래쉬)

//------------------------------------
//OPAQUE_HANDLE 을 사용한다면?
typedef struct _IPLCONTEXT_t* IPLContext;
typedef struct _IPLScene_T* IPLScene;

IPLContext stc = iplContextCreate(...);
iplSceneRelease(ctx)
// 컴파일 에러 IPLContext != IPLScene

```

---

# 5. Source file links

<strong style="color:#b3f594">util.h</strong>
- [util.h 링크](https://github.com/ValveSoftware/steam-audio/blob/v4.8.1/core/src/core/util.h)

---




