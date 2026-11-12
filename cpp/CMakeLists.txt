cmake_minimum_required(VERSION 3.16)
project(rubiks_cube_solver LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

add_library(rubik_engine
    src/cube.cpp
    src/move.cpp
    src/cubie.cpp
    src/scrambler.cpp
    src/pattern_db.cpp
    src/ida_star.cpp
    src/kociemba.cpp
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

add_executable(test_solver_pdb
    tests/test_solver_pdb.cpp
)
target_link_libraries(test_solver_pdb PRIVATE rubik_engine)
target_compile_options(test_solver_pdb PRIVATE
    -Wall -Wextra -Wpedantic
)

add_test(NAME solver_pdb_tests COMMAND test_solver_pdb)

add_executable(test_solver_kociemba
    tests/test_solver_kociemba.cpp
)
target_link_libraries(test_solver_kociemba PRIVATE rubik_engine)
target_compile_options(test_solver_kociemba PRIVATE
    -Wall -Wextra -Wpedantic
)

add_test(NAME solver_kociemba_tests COMMAND test_solver_kociemba)

add_executable(rubik_solver
    src/main_cli.cpp
)
target_link_libraries(rubik_solver PRIVATE rubik_engine)
target_compile_options(rubik_solver PRIVATE
    -Wall -Wextra -Wpedantic
)

add_executable(benchmark_solvers
    src/benchmark_solvers.cpp
)
target_link_libraries(benchmark_solvers PRIVATE rubik_engine)
target_compile_options(benchmark_solvers PRIVATE
    -Wall -Wextra -Wpedantic
)
