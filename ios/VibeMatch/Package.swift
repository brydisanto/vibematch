// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeMatch",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "VibeMatch", targets: ["VibeMatch"]),
    ],
    targets: [
        .target(
            name: "VibeMatch",
            path: ".",
            exclude: ["Package.swift"],
            resources: [.process("Resources")]
        ),
    ]
)
