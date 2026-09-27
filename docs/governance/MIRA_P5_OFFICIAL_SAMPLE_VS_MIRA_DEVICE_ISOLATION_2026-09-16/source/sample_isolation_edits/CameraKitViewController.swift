//
//  CameraKitViewController.swift
//  PerfectLibDemo
//
//  Created by i lin on 2026/03/16.
//  Copyright © 2026 Perfect Corp. All rights reserved.
//

import UIKit
import PerfectLibCameraKit
import AVFoundation
import Photos

extension CameraKitQualityCheck {
    func canCapture() -> Bool {
        return lightingQuality.isOk && faceAreaQuality.isOk && facePoseQuality.isOk
    }
}

private enum CheckerModeOption: Int, CaseIterable {
    case strict = 0
    case moderate
    case relaxed

    var title: String {
        switch self {
        case .strict:
            return "Strict"
        case .moderate:
            return "Moderate"
        case .relaxed:
            return "Relaxed"
        }
    }

    var cameraKitLevel: PFCameraKitLevel {
        switch self {
        case .strict:
            return .strict
        case .moderate:
            return .moderate
        case .relaxed:
            return .relaxed
        }
    }
}

private struct ManualParameterField {
    let title: String
    let currentValue: Float
    let range: ClosedRange<Float>

    var formattedValue: String {
        String(format: "%.2f", currentValue)
    }
}

private extension UIColor {
    static let perfectCorpPink = UIColor(red: 235.0 / 255.0, green: 39.0 / 255.0, blue: 119.0 / 255.0, alpha: 1.0)
}

class CameraKitViewController: UIViewController, UIImagePickerControllerDelegate, UINavigationControllerDelegate
{
    @IBOutlet weak var backButton: UIButton!
    @IBOutlet weak var cameraKitView: UIView!
    @IBOutlet weak var qualityIndicatorView: UIStackView!
    @IBOutlet weak var lightingQuality: UIView!
    @IBOutlet weak var lightingQualityMsg: UILabel!
    @IBOutlet weak var faceFrontalQuality: UIView!
    @IBOutlet weak var faceAreaQuality: UIView!
    @IBOutlet weak var faceAreaQualityMsg: UILabel!
    @IBOutlet weak var importPhotoButton: UIButton!
    
    private var cameraKit: CameraKit?
    /// Isolation comparison default: MODERATE (matches Mira). Not a threshold change.
    private var selectedCheckerMode: CheckerModeOption = .moderate
    private var currentCameraPosition: AVCaptureDevice.Position = .front
    private var isolationSessionId: Int64 = 0
    private var isolationQualityCount: Int64 = 0
    private var isolationLastLogMs: Int64 = 0
    private var isolationCanCaptureStreakStartMs: Int64?
    private var isolationLongestCanCaptureMs: Int64 = 0
    private lazy var checkerModeControl: UISegmentedControl = {
        let control = UISegmentedControl(items: CheckerModeOption.allCases.map { $0.title })
        control.translatesAutoresizingMaskIntoConstraints = false
        control.selectedSegmentIndex = CheckerModeOption.moderate.rawValue
        control.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        if #available(iOS 13.0, *) {
            control.selectedSegmentTintColor = .perfectCorpPink
        } else {
            control.tintColor = .perfectCorpPink
        }
        control.setTitleTextAttributes([
            .font: UIFont.systemFont(ofSize: 12, weight: .medium),
            .foregroundColor: UIColor.white
        ], for: .normal)
        control.setTitleTextAttributes([
            .font: UIFont.systemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: UIColor.white
        ], for: .selected)
        control.addTarget(self, action: #selector(actionCheckerModeChanged(_:)), for: .valueChanged)
        return control
    }()
    private lazy var manualSettingsButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        if #available(iOS 13.0, *) {
            button.setImage(UIImage(systemName: "slider.horizontal.3"), for: .normal)
        } else {
            button.setTitle("Set", for: .normal)
        }
        button.tintColor = .white
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        button.layer.cornerRadius = 16
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        button.addTarget(self, action: #selector(actionOpenManualParameterSettings(_:)), for: .touchUpInside)
        return button
    }()
    private lazy var flipCameraButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Flip", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        button.layer.cornerRadius = 16
        button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        if #available(iOS 13.0, *) {
            button.layer.borderColor = UIColor.perfectCorpPink.cgColor
        } else {
            button.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        }
        button.layer.borderWidth = 1
        button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        button.addTarget(self, action: #selector(actionFlipCamera(_:)), for: .touchUpInside)
        return button
    }()
    
    private var session: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var videoInput: AVCaptureDeviceInput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var hasSetCamera = false
    private var latestQualityCheck: CameraKitQualityCheck?
    private var isCaptureInProgress = false
    private var capturedImage: UIImage?
    private lazy var captureButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Capture", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.setTitleColor(UIColor.white.withAlphaComponent(0.5), for: .disabled)
        button.backgroundColor = UIColor.perfectCorpPink.withAlphaComponent(0.9)
        button.layer.cornerRadius = 28
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        button.layer.borderWidth = 1
        button.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 24, bottom: 14, right: 24)
        button.addTarget(self, action: #selector(actionCapture(_:)), for: .touchUpInside)
        button.isEnabled = false
        button.alpha = 0.5
        return button
    }()
    private lazy var capturedImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        imageView.backgroundColor = .black
        return imageView
    }()
    private lazy var discardCaptureButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Back", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor.black.withAlphaComponent(0.45)
        button.layer.cornerRadius = 22
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        button.contentEdgeInsets = UIEdgeInsets(top: 10, left: 20, bottom: 10, right: 20)
        button.addTarget(self, action: #selector(actionDiscardCapturedImage(_:)), for: .touchUpInside)
        return button
    }()
    private lazy var saveCaptureButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Save", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor.perfectCorpPink.withAlphaComponent(0.95)
        button.layer.cornerRadius = 22
        button.contentEdgeInsets = UIEdgeInsets(top: 10, left: 20, bottom: 10, right: 20)
        button.addTarget(self, action: #selector(actionSaveCapturedImage(_:)), for: .touchUpInside)
        return button
    }()
    private lazy var captureReviewView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .black
        view.isHidden = true
        view.alpha = 0
        return view
    }()
    
    private func correctView(to size: CGSize? = nil) {
        // Set device orientation based on UI
        let height = size?.height ?? UIScreen.main.bounds.height
        let width = size?.width ?? UIScreen.main.bounds.width
        
        self.cameraKitView.center = CGPoint(x: width / 2, y: height / 2)
        
        switch currentDeviceOrientation() {
        case .portrait:
            self.cameraKitView.transform = .identity
        case .portraitUpsideDown:
            self.cameraKitView.transform = CGAffineTransform(rotationAngle: .pi)
        case .landscapeLeft:
            self.cameraKitView.transform = CGAffineTransform(rotationAngle: -.pi / 2)
        case .landscapeRight:
            self.cameraKitView.transform = CGAffineTransform(rotationAngle: .pi / 2)
        default:
            self.cameraKitView.transform = .identity
        }
    }
    
    var currentPreset: AVCaptureSession.Preset? {
        didSet {
            guard let preset = self.currentPreset else { return }
            SynchronousTool.asyncMainSafe { [weak self] in
                guard let self = self else { return }
                var frame : CGRect
                if preset == .photo {
                    frame = self.getFrameBy(aspectRatio: 4.0/3.0)
                }
                else {
                    frame = self.getFrameBy(aspectRatio: 16.0/9.0)
                }
                self.cameraKitView.bounds = frame
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupCheckerModeUI()
        setupCaptureUI()
        
        if let modelPath = Bundle.main.path(forResource: "model", ofType: ""), !modelPath.isEmpty {
            CameraKit.create(withModelPath: modelPath) { [weak self] (cameraKit, error) in
                if let error = error {
                    SynchronousTool.asyncMainSafe {
                        let alert = UIAlertController(title: "Error", message: error.localizedDescription, preferredStyle: .alert)
                        alert.addAction(UIAlertAction(title: "OK", style: .destructive, handler: { (_) in
                            self?.navigationController?.popViewController(animated: true)
                        }))
                        self?.present(alert, animated: true, completion: nil)
                    }
                    return
                }
                self?.cameraKit = cameraKit
                self?.cameraKit?.delegate = self
                self?.isolationSessionId += 1
                self?.applyCheckerMode()
                self?.logIsolationFinalConfig(reason: "after_create_applyCheckerMode")
            }
        } else {
            SynchronousTool.asyncMainSafe { [weak self] in
                let alert = UIAlertController(title: "Error", message: "Model path is missing.", preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .destructive, handler: { (_) in
                    self?.navigationController?.popViewController(animated: true)
                }))
                self?.present(alert, animated: true, completion: nil)
            }
        }
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if !hasSetCamera {
            currentPreset = .photo
            #if !targetEnvironment(simulator)
            setupCameraAndPreview()
            #endif
            correctView()
            hasSetCamera.toggle()
        }
    }
    
    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        correctView(to: size)
    }

    private var appActiveObserver: NSObjectProtocol? = nil
    private var appInactiveObserver: NSObjectProtocol? = nil
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        session?.startRunning()
        appActiveObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil) { [weak self] (notification) in
            guard let self = self else {
                return
            }
            DispatchQueue.global(qos: .background).async { [weak self] in
                guard let self = self else { return }
                self.session?.startRunning()
            }
        }
        
        appInactiveObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] (notification) in
            DispatchQueue.global(qos: .background).async { [weak self] in
                guard let self = self else { return }
                self.session?.stopRunning()
            }
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)

        session?.stopRunning()
        if let appActiveObserver = appActiveObserver {
            NotificationCenter.default.removeObserver(appActiveObserver)
        }
        if let appInactiveObserver = appInactiveObserver {
            NotificationCenter.default.removeObserver(appInactiveObserver)
        }
    }
    
    deinit {
        cameraKit = nil
    }

    // MARK: - actions
    @IBAction func actionBack(_ sender: Any) {
        navigationController?.popViewController(animated: true)
    }

    @objc private func actionCheckerModeChanged(_ sender: UISegmentedControl) {
        guard let mode = CheckerModeOption(rawValue: sender.selectedSegmentIndex) else {
            sender.selectedSegmentIndex = selectedCheckerMode.rawValue
            return
        }

        selectedCheckerMode = mode
        applyCheckerMode()
    }

    @objc private func actionOpenManualParameterSettings(_ sender: UIButton) {
        presentManualParameterSettings()
    }

    @objc private func actionFlipCamera(_ sender: UIButton) {
        rotateCameraPosition()
    }

    @objc private func actionCapture(_ sender: UIButton) {
        guard latestQualityCheck?.canCapture() == true, isCaptureInProgress == false, capturedImage == nil else {
            return
        }
        capturePhoto()
    }

    @objc private func actionDiscardCapturedImage(_ sender: UIButton) {
        dismissCaptureReview()
    }

    @objc private func actionSaveCapturedImage(_ sender: UIButton) {
        saveCapturedImage()
    }
    
    // MARK: - private
    private func setupCheckerModeUI() {
        view.addSubview(checkerModeControl)
        view.addSubview(manualSettingsButton)
        view.addSubview(flipCameraButton)

        NSLayoutConstraint.activate([
            flipCameraButton.topAnchor.constraint(equalTo: backButton.bottomAnchor, constant: 12),
            flipCameraButton.leadingAnchor.constraint(equalTo: backButton.leadingAnchor),
            flipCameraButton.heightAnchor.constraint(equalToConstant: 32),

            checkerModeControl.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            checkerModeControl.trailingAnchor.constraint(equalTo: manualSettingsButton.leadingAnchor, constant: -12),
            checkerModeControl.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            checkerModeControl.heightAnchor.constraint(equalToConstant: 32),

            manualSettingsButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            manualSettingsButton.centerYAnchor.constraint(equalTo: checkerModeControl.centerYAnchor),
            manualSettingsButton.widthAnchor.constraint(equalToConstant: 40),
            manualSettingsButton.heightAnchor.constraint(equalToConstant: 32)
        ])
    }

    private func setupCaptureUI() {
        view.addSubview(captureButton)
        view.addSubview(captureReviewView)
        captureReviewView.addSubview(capturedImageView)
        captureReviewView.addSubview(discardCaptureButton)
        captureReviewView.addSubview(saveCaptureButton)

        NSLayoutConstraint.activate([
            captureButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureButton.bottomAnchor.constraint(equalTo: checkerModeControl.topAnchor, constant: -16),
            captureButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 56),

            captureReviewView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            captureReviewView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            captureReviewView.topAnchor.constraint(equalTo: view.topAnchor),
            captureReviewView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            capturedImageView.leadingAnchor.constraint(equalTo: captureReviewView.leadingAnchor),
            capturedImageView.trailingAnchor.constraint(equalTo: captureReviewView.trailingAnchor),
            capturedImageView.topAnchor.constraint(equalTo: captureReviewView.topAnchor),
            capturedImageView.bottomAnchor.constraint(equalTo: captureReviewView.bottomAnchor),

            discardCaptureButton.leadingAnchor.constraint(equalTo: captureReviewView.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            discardCaptureButton.bottomAnchor.constraint(equalTo: captureReviewView.safeAreaLayoutGuide.bottomAnchor, constant: -24),

            saveCaptureButton.trailingAnchor.constraint(equalTo: captureReviewView.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            saveCaptureButton.bottomAnchor.constraint(equalTo: captureReviewView.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])
    }

    private func applyCheckerMode() {
        cameraKit?.setCameraKitLevel(selectedCheckerMode.cameraKitLevel)
        logIsolationFinalConfig(reason: "applyCheckerMode")
    }

    /// Diagnostics only — does not change acceptance thresholds.
    private func logIsolationFinalConfig(reason: String) {
        guard let p = cameraKit?.currentParameter else {
            NSLog("MiraIsolation SAMPLE FINAL_CONFIG reason=%@ session=%lld level=%@ params=nil probe=CKISO-20260915A",
                  reason, isolationSessionId, selectedCheckerMode.title)
            return
        }
        NSLog(
            "MiraIsolation SAMPLE FINAL_CONFIG reason=%@ probe=CKISO-20260915A session=%lld sdk=%@ level=%@ yaw=%.1f size=%.2f lightL=%.2f lightU=%.2f pitchU=%.1f pitchL=%.1f",
            reason,
            isolationSessionId,
            PerfectLibCameraKitVer,
            selectedCheckerMode.title,
            p.faceYaw,
            p.faceSizeRatio,
            p.lightingLower,
            p.lightingUpper,
            p.facePitchUpper,
            p.facePitchLower
        )
    }

    private func presentManualParameterSettings() {
        guard let parameter = currentCameraKitParameter() else {
            presentSimpleAlert(title: "CameraKit Not Ready", message: "CameraKit parameters are not available yet.")
            return
        }

        let alert = UIAlertController(title: "Override Parameters", message: "Configure parameter overrides for the current level.", preferredStyle: .alert)
        let fields = manualParameterFields(parameter: parameter)

        for field in fields {
            alert.addTextField { textField in
                let titleLabel = UILabel()
                titleLabel.text = "\(field.title): "
                titleLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
                if #available(iOS 13.0, *) {
                    titleLabel.textColor = .secondaryLabel
                } else {
                    // Fallback on earlier versions
                }
                titleLabel.sizeToFit()
                textField.leftView = titleLabel
                textField.leftViewMode = .always
                textField.placeholder = "\(field.range.lowerBound) - \(field.range.upperBound)"
                textField.text = field.formattedValue
                textField.keyboardType = field.range.lowerBound < 0 ? .numbersAndPunctuation : .decimalPad
            }
        }

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Apply", style: .default, handler: { [weak self, weak alert] _ in
            guard let self = self, let alert = alert else { return }
            self.applyManualParameterChanges(from: alert.textFields ?? [])
        }))

        present(alert, animated: true)
    }

    private func manualParameterFields(parameter: CameraKitParameter) -> [ManualParameterField] {
        [
            ManualParameterField(title: "Face Size Ratio", currentValue: parameter.faceSizeRatio, range: 0.55...1.0),
            ManualParameterField(title: "Face Yaw", currentValue: parameter.faceYaw, range: 0.0...15.0),
            ManualParameterField(title: "Face Pitch Upper", currentValue: parameter.facePitchUpper, range: -20.0...10.0),
            ManualParameterField(title: "Face Pitch Lower", currentValue: parameter.facePitchLower, range: -20.0...10.0),
            ManualParameterField(title: "Lighting Upper", currentValue: parameter.lightingUpper, range: 0.8...1.0),
            ManualParameterField(title: "Lighting Lower", currentValue: parameter.lightingLower, range: 0.55...1.0)
        ]
    }

    private func applyManualParameterChanges(from textFields: [UITextField]) {
        guard let parameter = currentCameraKitParameter() else {
            presentSimpleAlert(title: "CameraKit Not Ready", message: "CameraKit parameters are not available yet.")
            return
        }

        let fields = manualParameterFields(parameter: parameter)
        guard textFields.count == fields.count else {
            return
        }

        var values = [Float]()
        for (index, field) in fields.enumerated() {
            guard let text = textFields[index].text,
                  let value = Float(text),
                  field.range.contains(value) else {
                presentSimpleAlert(title: "Invalid Value", message: "\(field.title) must be between \(field.range.lowerBound) and \(field.range.upperBound).")
                return
            }
            values.append(value)
        }

        applyParameterOverride(values: values)
    }

    private func applyParameterOverride(values: [Float]) {
        guard let currentParameter = currentCameraKitParameter() else {
            presentSimpleAlert(title: "CameraKit Not Ready", message: "CameraKit parameters are not available yet.")
            return
        }

        let builder = currentParameter.parameterBuilder

        builder
            .setFaceSizeRatio(values[0])
            .setFaceYaw(values[1])
            .setFacePitchUpper(values[2])
            .setFacePitchLower(values[3])
            .setLightingUpper(values[4])
            .setLightingLower(values[5])

        do {
            let parameter = try builder.build()
            cameraKit?.setCameraKitOverwrite(parameter)
        } catch {
            presentSimpleAlert(title: "Invalid Value", message: error.localizedDescription)
        }
    }

    private func currentCameraKitParameter() -> CameraKitParameter? {
        cameraKit?.currentParameter
    }

    private func updateCaptureButtonAvailability() {
        let canCapture = latestQualityCheck?.canCapture() == true && isCaptureInProgress == false && capturedImage == nil
        captureButton.isEnabled = canCapture
        captureButton.alpha = canCapture ? 1.0 : 0.5
    }

    private func capturePhoto() {
        guard let photoOutput = photoOutput else {
            return
        }

        let settings = AVCapturePhotoSettings()
        if photoOutput.isHighResolutionCaptureEnabled {
            settings.isHighResolutionPhotoEnabled = true
        }
        if let photoConnection = photoOutput.connection(with: .video),
           let orientation = AVCaptureVideoOrientation(deviceOrientation: currentDeviceOrientation()) {
            photoConnection.videoOrientation = orientation
        }

        isCaptureInProgress = true
        updateCaptureButtonAvailability()
        NSLog(
            "MiraIsolation SAMPLE capture REQUEST session=%lld canCapture=%d isValid=%d longestCanMs=%lld",
            isolationSessionId,
            (latestQualityCheck?.canCapture() == true) ? 1 : 0,
            (latestQualityCheck?.isValid == true) ? 1 : 0,
            isolationLongestCanCaptureMs
        )
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    private func showCaptureReview(with image: UIImage) {
        capturedImage = image
        capturedImageView.image = image
        NSLog(
            "MiraIsolation SAMPLE capture SUCCESS session=%lld imageW=%.0f imageH=%.0f (no image bytes logged)",
            isolationSessionId,
            image.size.width,
            image.size.height
        )
        session?.stopRunning()
        captureReviewView.isHidden = false
        view.bringSubviewToFront(captureReviewView)

        UIView.animate(withDuration: 0.2) {
            self.captureReviewView.alpha = 1
        }

        updateCaptureButtonAvailability()
    }

    private func dismissCaptureReview() {
        capturedImage = nil
        capturedImageView.image = nil

        UIView.animate(withDuration: 0.2, animations: {
            self.captureReviewView.alpha = 0
        }, completion: { _ in
            self.captureReviewView.isHidden = true
        })

        DispatchQueue.global(qos: .background).async { [weak self] in
            guard let self = self, self.view.window != nil else { return }
            self.session?.startRunning()
        }

        updateCaptureButtonAvailability()
    }

    private func saveCapturedImage() {
        guard let image = capturedImage else {
            return
        }

        let completion: (Bool) -> Void = { [weak self] granted in
            guard let self = self else { return }
            guard granted else {
                self.presentSimpleAlert(title: "Save Failed", message: "Photo library access is required to save the captured image.")
                return
            }

            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                SynchronousTool.asyncMainSafe {
                    if success {
                        self.presentSimpleAlert(title: "Saved", message: "The captured image was saved to Photos.")
                    } else {
                        self.presentSimpleAlert(title: "Save Failed", message: error?.localizedDescription ?? "Unable to save the captured image.")
                    }
                }
            }
        }

        if #available(iOS 14, *) {
            let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
            switch status {
            case .authorized, .limited:
                completion(true)
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                    completion(status == .authorized || status == .limited)
                }
            default:
                completion(false)
            }
        } else {
            let status = PHPhotoLibrary.authorizationStatus()
            switch status {
            case .authorized:
                completion(true)
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization { status in
                    completion(status == .authorized)
                }
            default:
                completion(false)
            }
        }
    }

    private func processedCapturedImage(_ image: UIImage) -> UIImage {
        let uprightImage = normalizedCapturedImage(image)

        guard currentCameraPosition == .front else {
            return uprightImage
        }

        return uprightImage.withHorizontallyFlippedOrientation()
    }

    private func normalizedCapturedImage(_ image: UIImage) -> UIImage {
        guard image.imageOrientation != .up else {
            return image
        }

        let rendererFormat = UIGraphicsImageRendererFormat.default()
        rendererFormat.scale = image.scale

        return UIGraphicsImageRenderer(size: image.size, format: rendererFormat).image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }

    private func presentSimpleAlert(title: String, message: String) {
        SynchronousTool.asyncMainSafe { [weak self] in
            guard let self = self else { return }
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
        }
    }

    private func rotateCameraPosition() {
        guard let session = session, let videoInput = videoInput else {
            return
        }

        let newPosition: AVCaptureDevice.Position = currentCameraPosition == .front ? .back : .front
        guard let input = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition) else {
            return
        }
        guard let deviceInput = try? AVCaptureDeviceInput(device: input) else {
            return
        }

        session.beginConfiguration()
        session.removeInput(videoInput)

        if session.canAddInput(deviceInput) {
            session.addInput(deviceInput)
            self.videoInput = deviceInput
            self.currentCameraPosition = newPosition
        } else {
            session.addInput(videoInput)
        }

        if let photoOutput = photoOutput,
           let photoOutputConnection = photoOutput.connection(with: .video),
           let newVideoOrientation = AVCaptureVideoOrientation(deviceOrientation: UIDevice.current.orientation) {
            photoOutputConnection.videoOrientation = newVideoOrientation
        }

        session.commitConfiguration()
        cameraKit?.onCameraOpen(currentCameraPosition == .front)
    }

    private func getFrameBy(aspectRatio ratio:CGFloat) -> CGRect {
        let screenW = min(UIScreen.main.bounds.width, UIScreen.main.bounds.height)
        let screenH = max(UIScreen.main.bounds.width, UIScreen.main.bounds.height)
        var w = screenW
        var h = w * ratio
        
        if h > screenH {
            h = screenH
            w = h / ratio
        }
        
        return CGRect(x: 0, y: 0, width: w, height: h)
    }
    
    private func currentDeviceOrientation() -> UIDeviceOrientation {
        guard (UIDevice.current.orientation != .portrait && UIDevice.current.orientation != .portraitUpsideDown &&
               UIDevice.current.orientation != .landscapeRight && UIDevice.current.orientation != .landscapeLeft) else {
            return UIDevice.current.orientation
        }
        
        var orientation : UIInterfaceOrientation?
        if #available(iOS 13.0, *) {
            orientation = UIApplication.shared.windows.first?.windowScene?.interfaceOrientation
        } else {
            orientation = UIApplication.shared.statusBarOrientation
        }
        
        switch orientation {
        case .unknown:
            return .portrait
        case .portrait:
            return .portrait
        case .portraitUpsideDown:
            return .portraitUpsideDown
        case .landscapeLeft:
            // UIInterfaceOrientationLandscapeLeft is equal to UIDeviceOrientationLandscapeRight
            return .landscapeRight
        case .landscapeRight:
            // UIInterfaceOrientationLandscapeRight is equal to UIDeviceOrientationLandscapeLeft
            return .landscapeLeft
        default:
            return .portrait
        }
    }
}

extension CameraKitViewController: CameraKitDelegate {
    func cameraKit(_ cameraKit: CameraKit, checkedResult: CameraKitQualityCheck) {
        SynchronousTool.asyncMainSafe { [weak self] in
            guard let self = self else { return }
            self.latestQualityCheck = checkedResult
            self.isolationQualityCount += 1
            let can = checkedResult.canCapture()
            let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
            if can {
                if self.isolationCanCaptureStreakStartMs == nil {
                    self.isolationCanCaptureStreakStartMs = nowMs
                }
                if let start = self.isolationCanCaptureStreakStartMs {
                    self.isolationLongestCanCaptureMs = max(self.isolationLongestCanCaptureMs, nowMs - start)
                }
            } else {
                self.isolationCanCaptureStreakStartMs = nil
            }
            // Throttle ~10Hz technical logs (no image content).
            if nowMs - self.isolationLastLogMs >= 100 {
                self.isolationLastLogMs = nowMs
                let areaName: String = {
                    switch checkedResult.faceAreaQuality {
                    case .good: return "good"
                    case .tooSmall: return "too_small"
                    case .outOfBoundary: return "out_of_boundary"
                    case .unknown: return "unknown"
                    @unknown default: return "unknown"
                    }
                }()
                let poseName: String = {
                    switch checkedResult.facePoseQuality {
                    case .good: return "good"
                    case .bad: return "bad"
                    case .unknown: return "unknown"
                    @unknown default: return "unknown"
                    }
                }()
                let lightName: String = {
                    switch checkedResult.lightingQuality {
                    case .good: return "good"
                    case .normal: return "normal"
                    case .overExposed: return "over_exposed"
                    case .underExposed: return "under_exposed"
                    case .backlighting: return "backlighting"
                    case .uneven: return "uneven"
                    case .unknown: return "unknown"
                    @unknown default: return "unknown"
                    }
                }()
                NSLog(
                    "MiraIsolation SAMPLE quality session=%lld n=%lld canCapture=%d isValid=%d area=%@ pose=%@ light=%@ deg=%.1f longestCanMs=%lld",
                    self.isolationSessionId,
                    self.isolationQualityCount,
                    can ? 1 : 0,
                    checkedResult.isValid ? 1 : 0,
                    areaName,
                    poseName,
                    lightName,
                    checkedResult.facePoseDegree,
                    self.isolationLongestCanCaptureMs
                )
            }
            self.lightingQuality.backgroundColor = checkedResult.lightingQuality.color
            self.faceFrontalQuality.backgroundColor = checkedResult.facePoseQuality.color
            self.faceAreaQuality.backgroundColor = checkedResult.faceAreaQuality.color
            self.lightingQualityMsg.text = checkedResult.lightingQuality.string
            self.faceAreaQualityMsg.text = checkedResult.faceAreaQuality.string
            self.updateCaptureButtonAvailability()
        }
    }
}

extension CameraKitViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
    
    func showCameraAccessDenied() {
        SynchronousTool.asyncMainSafe { [weak self] in
            guard let self = self else { return }
            let alert = UIAlertController(title: "Camera Access Denied", message: "Camera access is required. Please enable camera access for the app in Settings -> Privacy -> Camera.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Dismiss", style: .cancel, handler: { (_) in
                self.navigationController?.popViewController(animated: true)
            }))
            self.present(alert, animated: true, completion: nil)
        }
    }
    
    func requestCameraAuthentication(_ completion: @escaping (_ authorized: Bool)->Void) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        if status == .notDetermined {
            AVCaptureDevice.requestAccess(for: .video) { authorized in
                completion(authorized)
            }
        }
        else {
            completion(status == .authorized)
        }
    }
    
    func setupCameraAndPreview() {
        requestCameraAuthentication { [weak self] authorized in
            guard let self = self else { return }
            if authorized {
                SynchronousTool.asyncMainSafe { [ weak self] in
                    guard let self = self else { return }
                    self._setupCameraAndPreview()
                }
            }
            else {
                self.showCameraAccessDenied()
            }
        }
    }
    
    func _setupCameraAndPreview() {
        guard let input = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: currentCameraPosition) else { fatalError() }
        let session = AVCaptureSession()
        
        session.beginConfiguration()
        guard let deviceInput = try? AVCaptureDeviceInput(device: input) else { fatalError() }
        if session.canAddInput(deviceInput) {
            session.addInput(deviceInput)
            self.videoInput = deviceInput
        }
        
        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
        output.alwaysDiscardsLateVideoFrames = false
        
        let queue = DispatchQueue(label: "com.perfectlib.processsamplebuffer")
        output.setSampleBufferDelegate(self, queue: queue)
        
        if session.canAddOutput(output) {
            session.addOutput(output)
        }
        
        let photoOutput = AVCapturePhotoOutput()
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)

            self.photoOutput = photoOutput
            photoOutput.isHighResolutionCaptureEnabled = true
            
            let deviceOrientation = UIDevice.current.orientation
            if let photoOutputConnection = photoOutput.connection(with: .video), let newVideoOrientation = AVCaptureVideoOrientation(deviceOrientation: deviceOrientation) {
                photoOutputConnection.videoOrientation = newVideoOrientation
            }
        }
        
        session.sessionPreset = currentPreset!
        
        session.commitConfiguration()
        
        previewLayer?.removeFromSuperlayer()
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.frame = CGRect(origin: CGPoint.zero, size: self.cameraKitView.frame.size)
        previewLayer.videoGravity = .resizeAspectFill
        cameraKitView.layer.addSublayer(previewLayer)
        self.previewLayer = previewLayer
        
        DispatchQueue.global(qos: .background).async {
            session.startRunning()
        }
        
        self.session = session
        cameraKit?.onCameraOpen(currentCameraPosition == .front)
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        cameraKit?.sendCameraBuffer(sampleBuffer)
    }
}

extension CameraKitViewController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            SynchronousTool.asyncMainSafe { [weak self] in
                guard let self = self else { return }
                self.isCaptureInProgress = false
                self.updateCaptureButtonAvailability()
                self.presentSimpleAlert(title: "Capture Failed", message: error.localizedDescription)
            }
            return
        }

        guard let imageData = photo.fileDataRepresentation(), let image = UIImage(data: imageData) else {
            SynchronousTool.asyncMainSafe { [weak self] in
                guard let self = self else { return }
                self.isCaptureInProgress = false
                self.updateCaptureButtonAvailability()
                self.presentSimpleAlert(title: "Capture Failed", message: "Unable to create an image from the camera frame.")
            }
            return
        }

        SynchronousTool.asyncMainSafe { [weak self] in
            guard let self = self else { return }
            self.isCaptureInProgress = false
            self.showCaptureReview(with: self.processedCapturedImage(image))
        }
    }
}

// MARK: - extensions for PerfectLib enumeratios
extension PFCameraKitFacePoseQuality {
    var color: UIColor {
        switch self {
        case .good:
            return #colorLiteral(red: 0.4666666687, green: 0.7647058964, blue: 0.2666666806, alpha: 1)
        case .bad:
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        case .unknown:
            return #colorLiteral(red: 0.2549019754, green: 0.2745098174, blue: 0.3019607961, alpha: 1)
        @unknown default:
            fatalError()
        }
    }
    var string: String {
        switch self {
        case .bad: return "Look Straight"
        default: return ""
        }
    }
    var isOk: Bool {
        return self == .good
    }
}

extension PFCameraKitFaceAreaQuality {
    var color: UIColor {
        switch self {
        case .good:
            return #colorLiteral(red: 0.4666666687, green: 0.7647058964, blue: 0.2666666806, alpha: 1)
        case .outOfBoundary:
            return #colorLiteral(red: 0.5568627715, green: 0.3529411852, blue: 0.9686274529, alpha: 1)
        case .tooSmall:
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        case .unknown:
            return #colorLiteral(red: 0.2549019754, green: 0.2745098174, blue: 0.3019607961, alpha: 1)
        @unknown default:
            fatalError()
        }
    }
    var string: String {
        switch self {
        case .tooSmall: return "Too Far Away"
        case .outOfBoundary: return "Move Backward"
        default: return ""
        }
    }
    var isOk: Bool {
        return self == .good
    }
}

extension PFCameraKitLightingQuality {
    var color: UIColor {
        switch self {
        case .unknown:
            return #colorLiteral(red: 0.2549019754, green: 0.2745098174, blue: 0.3019607961, alpha: 1)
        case .normal:
            return #colorLiteral(red: 0.9686274529, green: 0.78039217, blue: 0.3450980484, alpha: 1)
        case .good:
            return #colorLiteral(red: 0.4666666687, green: 0.7647058964, blue: 0.2666666806, alpha: 1)
        case .overExposed:
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        case .uneven :
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        case .underExposed:
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        case .backlighting:
            return #colorLiteral(red: 0.7450980544, green: 0.1568627506, blue: 0.07450980693, alpha: 1)
        @unknown default: fatalError()
        }
    }
    
    var string: String {
        switch self {
        case .backlighting:
            return "BackLighting"
        case .uneven:
            return "Uneven"
        case .overExposed:
            return "OverExposed"
        case .underExposed:
            return "UnderExposed"
        default:
            return ""
        }
    }
    var isOk: Bool {
        return self == .good || self == .normal
    }
}

extension PFCameraKitQualityMsg {
    var string: String {
        switch self {
        case .faceAreaTooSmall:
            return "Too small"
        case .faceAreaOutOfBoundary:
            return "Out of boundary"
        case .lightingOverExposed:
            return "Over expo."
        case .lightingUnderExposed:
            return "Under expo."
        case .lightingBacklighting:
            return "Backlighting"
        case .lightingUneven:
            return "Uneven"
        default:
            return ""
        }
    }
}
