# Build: a static binary, so the final image needs nothing from a system.
FROM golang:1.27-alpine AS build
WORKDIR /src

# The module has no dependencies today; copying go.mod first keeps the download
# layer cached once it has some.
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/server ./cmd/server

# Run: distroless has no shell and no package manager, and ships a non-root user.
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/server /server

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/server"]
