---
title: "[ITest] Itest 분석"
author: KurtJang
tags:
  - Blog
  - "#Programming"
  - "#CPP"
  - SteamAudio
date: 2026-05-11
draft: "False"
description: "[SteamAudio] ITest.h/cpp 분석 (itest module)"
---

---
# 1. itest

- `itest.h` / `itest.cpp` 는 함수를 선택해서 실행하는 디스패처 시스템
- `phonon_itest.exe context` 처럼 이름을 인자로 넘기면 해당 itest 함수가 실행 된다

# 2. 구성 요소

1. `FunctionRegistry`
	- `typedef void (*Function)()`
		- void 함수 포인터
	- `registerFunction(name, function)`
		- 이름으로 함수 등록
	- `getFunctionName()`
		- 등록된 이름 목록 반환
	- `runFunction(name)`
		- 이름으로 함수 실행, 없으면 에러 출력

2. `getFunctionRegistry()`
	- `FunctionRegistry` 싱글톤 반환
	- `IPL_BUILDING_MAIN` 이 정의된 곳에서만 본문 생성
	- 나머지 파일에서는 선엄나 보냄

3. `ITEST(name)` 매크로
	- 함수선언 + `SelfRegisteringFunction` 전역 객체 + 함수 본문을 한번에 생성

4. `main()`
	- `argc != 2` 이면 `usage()` 출력
	- `argv[1]` 로 `runFunction()` 호출

---

# 3. 예제 코드

``` cpp
ITEST (context)
{
    //테스트 코드
}

//전처리기가 이렇게 전개
//함수 전방 선언
static void itest_context();

//전역 객체 생성 -> 생성자에게 Registry에 "Context" 등록
SelfRegisteringFunction register_itest_context("context", itest_context);

static void itest_context()
{
    //테스트 코드
}

```

---

# 4. 실제 코드
``` cpp
class FunctionRegistry
{
public:
    typedef void (*Function());
    // void 형 함수 포인터
    // 값 예시 : itest_context 함수의 주소

    void registerFunction(const std::string& name, Function function)
    {
        m_functions[name] = function;
        // context 라는 string에 itest_context 함수 주소 저장
        // map 이므로 이름이 중복되면 덮어씀
    }

    std::vector<std::string> getFunctionNames() const
    {
        std::vector<std::String> names;
        for (const auto& kv : m_functions)
        {
            names.push_back(kv_first);
        }

        return names;
        // {context, 'audioengine', 'convlution'} 같은 목록 반환
        // usage( 에서 목록 출력에 사용
    }

    bool RunFunction(const std::string& name)
    {
        if (m_functions.find(name) != m_functions.end())
        {
            m_functions[name]();
            //context를 넘기면 itest_context() 호출
            return true;
        }
        else
        {
            printf("ERROR : No function defined or name : %s\n", name.c_str());
            //등록되지 않은 이름 출력
        }
    }

private:
    std::map<std::String, Function> m_functions;
    //이름/함수 맵핑
}

#if defined (IPL_BUILDING_MAIN)
FunctionRegistry& getFunctionReigstry()
{
    //싱글톤 반환
	static FunctionRegistry functionRegistry();
	return functionRegistry;
}
#else
FunctionRegistry& getFunctionReigstry();
// 선엄나 본움ㄴ은 itest.cpp에
#endif

class SlefReigstringFunction
{
public:
	SelfRegisteringFunction(const std::String& name, FunctionRegistry::Function function)
	{
	    getFunctionRegistry().registerFunction(name, function);
	    //생성자에서 즉시 registry 등록
	    //전역 객체로 선언되므로 main() 이전에 자동 실행
	}
}


#define ITEST(name) \
	static void itest_##name(); \
	SelfRegisterFunction register_itest_##name(#name, itest_##name) \
	static_void itest_##name()

// ## : 토큰 붙이기 ITEST(Context) -> itest_context
// #name : 문자열 반환, ITEST(context) -> "context" 반환
// 세미콜론 없음 : 매크로 뒤에 {} 본문을 바로 붙일 수 있음

//eg) ITEST(gui)를 호출하면
// static void itest_gui();
// SelfRegisterFunction register_itest_gui("gui", itest_gui);
// static void itest_gui() 실행 - runFunction에서 (main)
//
//전방 선언을 꼭 해줘야 된다 (아니면 컴파일 에러)

//================================================================
//=====================    itest .cpp   ==========================
//================================================================
#include "itest.h"

void usage()
{
    auto names = getFunctionRegistry().getFunctionNames();

    printf("USAGE : phonon_itest <name>\n");
    printf("where <name> is one of : \n");

    for (const auto& name : names)
    {
        printf("\t%s\n", name.c_str());
        // 디버그 - 테스트 항목 프린트
    }
}

int main(int argc, char** argv)
{
    if (argc != 2)
    {
	    //argc = 인자 개수, argv[0] = 실행파일 이름
	    //phonon_itest.exe context -> argc = 2, argv[1] = "context"
	    //phonon_itest.exe         -> argc = 1 -> usage 출력

        usage();
        return 0;
    }

    if (!getFunctionRegistry().runFunction(argv[1]))
    {
        //argv[1] = "context" -> itest_context() 실행
        //없는 이름이면 false -> usage 출력
        usage();
    }

    return 0;
}

```

---

# 5. 전체 실행 흐름

> [!info] 전체 실행 흐름
>
> 전역 객체 생성 (main 이전) <br>
> 1. `SelfRegisteringFunction register_itest_context`
> 2. `getFunctionRegistry()["context"] = itest_context`
> 3. `SelfRegisteringFunction register_itest_audioengine`
> 4. `getFunctionRegistry()["audioengine"] = itest_audioengine`
><br>
>
>메인 함수에서
> 1. `main (argc = 2, argv=['phonon_itest.exe", "context"])`
> 2. `getFunctionRegistry().runFunction("context`)
> 3. `itest_context()` 실행

---
