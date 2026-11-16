---
title: "[Test] memory.test 분석"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - CPP
  - SteamAudio
date: 2026-05-08
draft: "False"
description: "[SteamAudio] Memory.test.cpp 분석 (test module)"
---
---

# 1. How to Debug

<font color="#9fffa3">1. Core project release build</font> - core project에서 작업을 하고 release로 빌드를 진행한다

``` cpp
//예시 - core 프로젝트 release로 빌드
cmake --build _out --config Release --target core
pause
```

<font color="#9fffa3">2. Test project release build</font> - test project에서 catch2 테스트 코드를 작성하고 release로 빌드를
진행한다

``` cpp
//예시 - phonon_test 프로젝트 releaes로 빌드
cmake --build _out --config Release --target phonon_test
pause
```


<font color="#9fffa3">3. Test 실행</font> - release된 test 파일을 tag와 함꼐 실행하고 결과를 확인한다

``` cpp
//예시 - phonon_test.exe 경로 지정 에 memory tag를 가진 test 실행
location\phonon_test.exe "[memory]"
pause
```

![[SteamAudio_Catch2_Test_Result.webp|478]] - 테스트 성공시 아래와 같이 `test passed` 출력

---

# 2. 함수 분석

## 1. callback
``` cpp
#include <catch.hpp> // catch2

#include <memory_allocaltor.h>
#include <context.h>
#include <types.h>
#include <containers.h>
#include <array.h>


#if defined(IPL_OS_WINDOWS) && !defined(_DEBUG)

// 커스덤 할당자가 몇바이트를 할당했는지 기록하눈 카운터
// TEST_CASE 시작시 0 으로 초기화
gByteAllocated = 0;

void* IPL_CALLBACK allocateMemory(const size_t size, const size_t alignment)
{
    gByteAllocated += size;  //요청 크기 누적
    return malloc(size);     //실제 할당
}

void IPL_CALLBACK freeMemory(void* memoryBlock)
{
    free(memoryBlock);
}

// 힙에서 현재 사용중인 메모리 총량을 바이트로 반환
init measureHeap()
{
    //1. 이 프로세스의 heap handle 획득
    auto heap = GetProcessorHeap();
    //2. 다른 스레드가 heap을 건드리지 못하게 잠금
    HeapLock(heap);

    //3. 순회 시작점을 초기화
    PROCESS_HEAP_ENTRY heapEntry;
    heapEntry.lpData = nullptr;

    auto size = 0;

    //4. 블록을 하나씩 순회
    while(HeapWalk(heap, &heapEntry))
    {
        //5. 사용중인 블록만 크기 누적
        if(heapEntry.wFlags &
        (PROCESS_HEAP_ENTRY_BUSY | PROCESS_HEAP_ENTRY_MOVABLE))
        {
            //6. 여기서 크기 누적
            size += heapEntry.cbData;
        }
    }

    //7. 잠금 해제
    HeapUnLock(heap);

    //8. 사용중인 총 바이트 반환
    return size;
}

#endif

```
---

## TEST 1 - manual

``` cpp

//TEST 1
TEST_CASE("Memory::allocate allocation are routed correctly", "[memory]")
{
    //1. 카운터 초기화
    // 이전 테스트에서 남은 값을 지운다
    gBytesAllocated = 0;

    //2. 커스덤 할당자 지원
    //이제부터 gMemory().allocate() ->allocateMemory() callback 경유
    ipl::gMemory().init(allocateMemory, freeMemory);

    //3. 할당 전 heap snaptshot
    //예 : 현재 heap 사용량 = 50,000 바이트
    auto baseline = measureHeap();
    //baseline = 50,000

    //4. 실제 할당
    //allocateMemory(1024, 64) 콜백 실행
    //예 : gBytesAllocated += 1024 -> gBytesAllocated = 1024
    //     malloc(1024) -> heap : 50,000 + 1024 = 51,024
    auto memoryBlock = ipl::gMemory().allocate(1024,
										   ipl::Memory::kDefaultAlignment);

    //5. Heap 증가량 측정
    auto bytesAllocated = measureHeap() - baseline;
    //measureHeap() = 51.024
    //51,024 - 50,000 = 1024
    //bytesAllocated = 1024

    //6. 메모리 해제
    //freeMemory(memBlock) + free()
    //heap : 51,024 -> 50,000 (원복)
    ipl:gMemory().free(memoryBlock);

    //7. 할당자 원복
    //다음 테스트가 기본 malloc/free로 시작하도록 정리
    ipl::gMemory().init(nullptr, nullptr);

    //8. 검증
    REQUIRE(bytesAllocated == gBytesAllocated);

    //reuslt = 1024
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = " << gBytesAllocated);
}


```
---

## TEST 2 - STL container
``` cpp
TEST_CASE("STL container allocation are routed correctly", "[memory])
{
	//1. 카운터 초기화
    gBytesAllocated = 0;

    //2. cllback 추가
    ipl::gMemory().init(allocateMemory, freeMemory);

    auto bytesAllocated = 0;

    {
        //3. 할당 전 snapshot
        auto baseline = measureHeap();

        //4. ipl::vector 생성
        //ipl::vector -> allocator<float>::allocate(32)
        //gMemory.allocate(128, 64) -> allocateMemory callback
        //gBytesAllocated += 128
        //malloc(128) -> heap 128 증가
        ipl::vector<float> container(32);
        //float 4 bytes * 32 = 128 bytes

        //5. heap  증가량 측정
        bytesAllocated = measureHeap() - baseline;

        //container 소멸 -> deallocate -> gMemory.free()
    }

    //6. callback 초기화
    ipl::gMemory().init(nullptr, nullptr);

     //. 검증
    //"ipl::vector 의 할당량이 gMemory() 콜백을 통과했는가?
    REQUIRE(bytesAllocated == gBytesAllocated);

    //result = 128
    //float(4) * 32 = 128
    //begin,end,capacity - stack에 저장
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = "  << gBytesAllocated);


}
```
---

## TEST 3 - make_unique
``` cpp
strcut BigObject
{
    ipl::vector<float> data;
    BigObject(const size_t numElements)
        : data(numElements)
    {}

}

TEST_CASE("make_unique allocation are routed correctly", "[memory]")
{
    gBytesAllocated = 0;
    ipl::gMemory().init(allocateMemory, freeMemory);

    auto bytesAllocated = 0;

    {
        //ipl::make_unique<bigObject>(32)
        /* 내부에서 2번 할당 발생
         *
         * 할당 1: gMemory().allocate(sizeof(BigObject), 64)
         * BigObject 객체 자체 공간
         *
         * 할당 2:  BigObject 생성자 -> data(32)
         * allocator<float>::allocate(32)
         * gMemory().allocate(128,64)
        */
	    auto bigObject = ipl::make_unique<BigObject>(32);
	    bytesAllocated = measureHeap() - baseline;

	    //bigObject 소멸 -> deleter 실행 -> gMemory().free 2번 호출
    }

    ipl::gMemory().init(nullptr, nullptr);

    //make_uqniue의 모든 할당이 gMemory()를 통과했는가?
    REQUIRE(bytesAllocated == gBytesAllocated);

    //result = 152
    //float(4) * 32 = 128
    //3 pointers = begin,end,capacity
    //BigObject안에 vector가 있어서 이건 heap에 생성됨
    //따라서 128 + (8 * 3) = 152
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = " << gBytesAllocated);
}

```
---

## TEST 4 - make_shared
``` cpp
TEST_CASE("make_shared allocation are routed correctly", "[memory]")
{
    gBytesAllocated = 0;
    ipl::gMemory().init(allocateMemory, freeMemory);

    auto bytesAllocated = 0;

    {
        auto baseline = measureHeap();

        // std:allocate_shared -> allocator<T> 경유
        // make_unique 와 구조 동일
        // 차이 : shared_ptr  은 내부적으로 ref count도 할당
        // 할당 횟수가 make_unique 보다 많을 수 있음
        auto bigObject = ipl::make_shared<BigObject>(32);

        bytesAllocated = measureHeap() - baseline;

        //bigObject 소멸 -> 참조 카운터 0 -> gMemory.free();
    }

    REQUIRE(bytesAllocate == gBytesAllocated):

    //result = 168
    //float(4) * 32 = 128
    //2 pointers - deleter pointer, allocator pointer
    //2 variables - strong ref count, weak ref count
    //128 + pointers (8 * 2) + variables (4 * 2) = 168
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = " << gBytesAllocated);
}
```
---

## TEST 5 - Array 1D
``` cpp
TEST_CASE("Array<T> allocation are routed correctly", "[memory]")
{
    gBytesAllocated = 0;
    ipl::gMemory().init(allocateMemory, freeMemory);

    auto bytesAllocated = 0;

    {
        auto baseline = measureHeap();

        //ipl::Array<float> -> 내부적으로 gMemory().allocate 호출
        //float 4 bytes * 32 = 128
        ipl::Array<float> container(32);

        bytesAllocated = measureHeap() - baseline;

        //cotainer 소멸 -> gMemory.free()
    }

    ipl::gMemory().init(nullptr, nullptr);

    REQUIRE(bytesAllocate == gBytesAllocated):

    //result = 128
    //float(4) * 32 = 128
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = " << gBytesAllocated);
}
```
---

## TEST 6 - Array 2D
``` cpp
TEST_CASE("Array<T,2> allocation are routed correctly", "[memory]")
{
    gBytesAllocated = 0;
    ipl::gMemory().init(allocateMemory, freeMemory);

    auto bytesAllocated = 0;

    {
        auto baseline = measureHeap();
        ipl::Array<float, 2> container (32, 5);

        bytesAllocated = measureHeap() - baseline;

        //container 소멸 -> gMemory().free()
    }

    REQUIRE(bytesAllocate == gBytesAllocated):

    //result = 896
    //Array<float, 2> (32,5)
    //mElements - float data - float(4) * 32 * 5 = 640
    //mPointers - Array<float*, 1> - 32ea = pointers(8) * 32 = 256
    //total = 640 + 256 = 896_
    WARN("bytesAllocated = " << bytesAllocated);
    WARN("gBytesAllocated = " << gBytesAllocated);
}

```
---

# 3. ETC
## 1. Windows Heap

- Test에서 heap을 측정해야 되기에 Windows Heap에 대한 내용이 필요함

``` cpp

// 윈도우 힙 블록하나의 구조체
PROCESS_HEAP_ENTRY heapEntry;

// 이 블록의 시작 주소
heapEntry.lpData;

// 이 블록의 크기 (Byte)
heapEntry.cbData;

//이 블록의 상태
heapEntry.wFlags;

//사용중인 블록 (malloc으로 할당됨)
heapEntry.wFlags & PROCESS_HEAP_ENTRY_BUSY

//이동 가능한 블록
heapEntry.wFlags & PROCESS_HEAP_ENTRY_MOVABLE

// HeapWalk (전체순회)
while (HeapWalk(heap, &heapEntry))
{
    //heap entry에 다른 블록 정보가 채워짐
}

```

## 2. Test code
``` cpp
 //== TEST 예제 ==


 //할당 전 총 용량
 auto baseline = measureHeap();

 //1024 바이트 할당
 auto ptr = gMemory().allocate(1024);

 //늘어난 양 = 1024
 auto after = measureHeap() - baseline;

 // 콜백도 1024를 기족했는지 확인
 REQUIRE(after == gBytesAllocated);

```



