// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
        .package(name: "CapacitorCommunityAdmob", path: "../../../node_modules/@capacitor-community/admob"),
        .package(name: "CapacitorFirebaseAuthentication", path: "../../../node_modules/@capacitor-firebase/authentication"),
        .package(name: "CapgoNativePurchases", path: "../../../node_modules/@capgo/native-purchases")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityAdmob", package: "CapacitorCommunityAdmob"),
                .product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
                .product(name: "CapgoNativePurchases", package: "CapgoNativePurchases")
            ]
        )
    ]
)
