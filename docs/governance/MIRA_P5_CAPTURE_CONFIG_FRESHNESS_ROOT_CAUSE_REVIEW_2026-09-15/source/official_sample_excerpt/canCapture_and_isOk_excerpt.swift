extension CameraKitQualityCheck {
    func canCapture() -> Bool {
        return lightingQuality.isOk && faceAreaQuality.isOk && facePoseQuality.isOk
    }
}

    var isOk: Bool {
        return self == .good || self == .normal
    }
}
