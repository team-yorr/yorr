FROM amazoncorretto:21-al2023-jdk AS build

WORKDIR /workspace

# Gradle Wrapper와 빌드 설정을 먼저 복사하여 의존성 레이어를 재사용한다.
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

RUN dnf install -y findutils && dnf clean all

RUN chmod +x gradlew && ./gradlew --no-daemon dependencies

COPY src ./src

# 테스트용 DB 프로필이 준비되기 전까지 이미지는 bootJar 패키징만 수행한다.
RUN ./gradlew --no-daemon clean bootJar -x test


FROM amazoncorretto:21-al2023-headless AS runtime

WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar /app/app.jar

# 애플리케이션을 root 권한으로 실행하지 않는다.
USER 10001

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]