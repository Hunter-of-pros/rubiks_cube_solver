cmake_minimum_required(VERSION 3.16)
project(rubiks_cube_solver LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(rubik_engine
    src/cube.cpp
    src/move.cpp
)

target_include_directories(rubik_engine PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_options(rubik_engine PRIVATE
    -Wall -Wextra -Wpedantic
)

enable_testing()

add_executable(test_cube
    tests/test_cube.cpp
)
target_link_libraries(test_cube PRIVATE rubik_engine)
target_compile_options(test_cube PRIVATE
    -Wall -Wextra -Wpedantic
)

add_test(NAME cube_tests COMMAND test_cube)
