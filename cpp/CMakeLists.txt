cmake_minimum_required(VERSION 3.16)
project(rubiks_cube_solver LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(rubik_engine
    src/cube.cpp
    src/move.cpp
    src/cubie.cpp
    src/scrambler.cpp
    src/ida_star.cpp
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

add_executable(test_engine
    tests/test_engine.cpp
)
target_link_libraries(test_engine PRIVATE rubik_engine)
target_compile_options(test_engine PRIVATE
    -Wall -Wextra -Wpedantic
)

add_test(NAME engine_tests COMMAND test_engine)

add_executable(test_solver_baseline
    tests/test_solver_baseline.cpp
)
target_link_libraries(test_solver_baseline PRIVATE rubik_engine)
target_compile_options(test_solver_baseline PRIVATE
    -Wall -Wextra -Wpedantic
)

add_test(NAME solver_baseline_tests COMMAND test_solver_baseline)
