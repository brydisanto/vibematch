// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PinDrop",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "PinDrop", targets: ["PinDrop"]),
    ],
    targets: [
        .target(
            name: "PinDrop",
            path: ".",
            exclude: ["Package.swift"],
            resources: [.process("Resources")]
        ),
    ]
)
