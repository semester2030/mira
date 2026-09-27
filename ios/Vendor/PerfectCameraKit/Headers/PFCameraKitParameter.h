//
//  PFCameraKitParameter.h
//  PerfectLibCameraKit
//
//  Created by I Lin on 2026/03/30.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class PFCameraKitParameterBuilder;

typedef NS_ENUM(NSUInteger, PFCameraKitLevel)
{
    PFCameraKitLevelStrict,
    PFCameraKitLevelModerate,
    PFCameraKitLevelRelaxed,
};

NS_SWIFT_NAME(CameraKitParameter)
/**
 Immutable CameraKit face check parameters created from `PFCameraKitParameterBuilder`.
 */
@interface PFCameraKitParameter : NSObject

@property (nonatomic, assign, readonly) PFCameraKitLevel currentLevel;
@property (nonatomic, assign, readonly) float faceSizeRatio;
@property (nonatomic, assign, readonly) float faceYaw;
@property (nonatomic, assign, readonly) float facePitchUpper;
@property (nonatomic, assign, readonly) float facePitchLower;
@property (nonatomic, assign, readonly) float lightingUpper;
@property (nonatomic, assign, readonly) float lightingLower;
@property (nonatomic, strong, readonly) PFCameraKitParameterBuilder *parameterBuilder;

- (id)init __attribute__((unavailable("Use CameraKitParameterBuilder to create CameraKitParameter.")));
+ (instancetype)new __attribute__((unavailable("Use CameraKitParameterBuilder to create CameraKitParameter.")));

@end

NS_SWIFT_NAME(CameraKitParameterBuilder)
/**
 Builder object for configuring CameraKit face check parameters.

 Unspecified values are filled from the preset values of the current parameter's
 `currentLevel` when `-build` is called.
 */
@interface PFCameraKitParameterBuilder : NSObject

/**
 Set the lower bound of the face ratio.
 Face width should be between `faceSizeRatio` × frame width and 1.0 × frame width.
 Checks vertical ratio in landscape mode and horizontal ratio in portrait mode.
 Valid range: 0.55 ~ 1.0.
 Presets: STRICT 0.75, MODERATE 0.65, RELAXED 0.55.
 */
- (instancetype)setFaceSizeRatio:(float)faceSizeRatio NS_SWIFT_NAME(setFaceSizeRatio(_:));

/**
 Set the absolute upper bound of head pose yaw.
 This value controls how far the head can look left or right.
 Valid range: 0.0 ~ 15.0.
 Presets: STRICT 5.0, MODERATE 10.0, RELAXED 15.0.
 */
- (instancetype)setFaceYaw:(float)faceYaw NS_SWIFT_NAME(setFaceYaw(_:));

/**
 Set the upper bound of head pose pitch.
 This value controls the allowed upward head pose.
 Valid range: -20.0 ~ 10.0.
 Presets: STRICT 0.0, MODERATE 5.0, RELAXED 10.0.
 */
- (instancetype)setFacePitchUpper:(float)facePitchUpper NS_SWIFT_NAME(setFacePitchUpper(_:));

/**
 Set the lower bound of head pose pitch.
 This value controls the allowed downward head pose.
 Valid range: -20.0 ~ 10.0.
 Presets: STRICT -10.0, MODERATE -15.0, RELAXED -20.0.
 */
- (instancetype)setFacePitchLower:(float)facePitchLower NS_SWIFT_NAME(setFacePitchLower(_:));

/**
 Set the upper bound of lighting condition.
 Valid range: 0.8 ~ 1.0.
 Presets: STRICT 0.9, MODERATE 0.85, RELAXED 0.8.
 */
- (instancetype)setLightingUpper:(float)lightingUpper NS_SWIFT_NAME(setLightingUpper(_:));

/**
 Set the lower bound of lighting condition.
 Valid range: 0.55 ~ 1.0.
 Presets: STRICT 0.8, MODERATE 0.7, RELAXED 0.55.
 */
- (instancetype)setLightingLower:(float)lightingLower NS_SWIFT_NAME(setLightingLower(_:));

- (nullable PFCameraKitParameter *)build:(NSError * _Nullable * _Nullable)error;

- (id)init __attribute__((unavailable("Use CameraKit currentParameter.parameterBuilder.")));
+ (instancetype)new __attribute__((unavailable("Use CameraKit currentParameter.parameterBuilder.")));

@end

NS_ASSUME_NONNULL_END
