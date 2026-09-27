//
//  PFCameraKitData.h
//  PerfectLib
//
//  Created by I Lin on 2026/3/26.
//  Copyright © 2026 Perfect Corp. All rights reserved.
//

#import <Foundation/Foundation.h>

/**
 Status codes for checking overall face area quality.
 */
typedef NS_ENUM(NSUInteger, PFCameraKitFaceAreaQuality) {
    PFCameraKitFaceAreaQualityUnknown,
    PFCameraKitFaceAreaQualityTooSmall,
    PFCameraKitFaceAreaQualityOutOfBoundary,
    PFCameraKitFaceAreaQualityGood
};

/**
 Status codes for checking face angle quality.
 */
typedef NS_ENUM(NSUInteger, PFCameraKitFacePoseQuality) {
    PFCameraKitFacePoseQualityUnknown,
    PFCameraKitFacePoseQualityBad,
    PFCameraKitFacePoseQualityGood
};

/**
 Status codes for checking lighting v2 quality.
 */
typedef NS_ENUM(NSUInteger, PFCameraKitLightingQuality) {
    PFCameraKitLightingQualityUnknown,
    PFCameraKitLightingQualityNormal,
    PFCameraKitLightingQualityGood,
    PFCameraKitLightingQualityOverExposed,
    PFCameraKitLightingQualityUnderExposed,
    PFCameraKitLightingQualityBacklighting,
    PFCameraKitLightingQualityUneven
};

/**
 Status codes for over all quality checking message.
 */
typedef NS_ENUM(NSUInteger, PFCameraKitQualityMsg) {
    PFCameraKitQualityMsgUnknown,
    PFCameraKitQualityMsgGood,
    PFCameraKitQualityMsgFaceAreaTooSmall,
    PFCameraKitQualityMsgFaceAreaOutOfBoundary,
    PFCameraKitQualityMsgLightingNormal,
    PFCameraKitQualityMsgLightingOverExposed,
    PFCameraKitQualityMsgLightingUnderExposed,
    PFCameraKitQualityMsgLightingBacklighting,
    PFCameraKitQualityMsgLightingUneven
};


NS_ASSUME_NONNULL_BEGIN

NS_SWIFT_NAME(CameraKitQualityCheck)
/**
 The results of skin analysis.
 Face width should be between 0.55 × frame width and 1.0 × frame width.
 */
@interface PFCameraKitQualityCheck : NSObject
/**
 The lighting quality.
 */
@property (nonatomic, readonly) PFCameraKitLightingQuality lightingQuality;
/**
 The face position quality.
 */
@property (nonatomic, readonly) PFCameraKitFaceAreaQuality faceAreaQuality;
/**
 The frontal face position quality.
*/
@property (nonatomic, readonly) PFCameraKitFacePoseQuality facePoseQuality;
/**
 The frontal face position degree.
*/
@property (nonatomic, readonly) float facePoseDegree;

/**
 Indicating if the information is valid.
 */
@property (nonatomic, readonly) BOOL isValid;


@end

NS_ASSUME_NONNULL_END
