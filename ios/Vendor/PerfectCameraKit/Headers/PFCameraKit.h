//
//  PFCameraKit.h
//  PerfectLibCameraKit
//
//  Created by I Lin on 2026/03/16.
//  Copyright © 2026 Perfect Corp. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <PerfectLibCameraKit/PFCameraKitParameter.h>

NS_ASSUME_NONNULL_BEGIN

@class PFCameraKit, PFCameraKitQualityCheck;

NS_SWIFT_NAME(CameraKitDelegate)
/**
This protocol provides information of the `PFCameraKit` object.
*/
@protocol PFCameraKitDelegate <NSObject>

@optional
/**
 This delegate method is called when getting the cameraKit check result.
 
 @param cameraKit  The `PFCameraKit` instance.
 @param checkedResult The analysis check result.
 */
- (void)cameraKit:(PFCameraKit *)cameraKit checkedResult:(PFCameraKitQualityCheck *)checkedResult;

@end

NS_SWIFT_NAME(CameraKit)
/**
The class performs face analysis.

Initialize a `PFCameraKit` object with `+[PFCameraKit createWithModelPath:completion:]`.
The object created will not open camera device and rendering view, external camera source is required.
Use `-sendCameraBuffer:` to input camera frames. Receive quality check results from `PFCameraKitDelegate`.
The relaxed level is applied by default when the object is initialized.

@note the kCVPixelBufferPixelFormatTypeKey must be specified as kCVPixelFormatType_420YpCbCr8BiPlanarFullRange when setting `AVCaptureVideoDataOutput.videoSettings`.
 
*/
@interface PFCameraKit : NSObject

/**
 Create a `PFCameraKit` instance.
 
 @param path Specify the path of the model files. If the path is null then the model files are in APP's main bundle.
 @param completion A completion called when the init operation completes.
*/
+ (void)createWithModelPath:(NSString * _Nullable)path completion:(void (^)(PFCameraKit * _Nullable cameraKit, NSError * _Nullable error))completion;

/// An object implements `PFCameraKitDelegate` protocol for receiving the quality of preview sent by calling `-sendCameraBuffer:`.
@property (weak, nonatomic) id<PFCameraKitDelegate> delegate;
@property (nonatomic, strong, readonly) PFCameraKitParameter *currentParameter;

/**
 Send the external camera's frame sample buffer in order for the engine to process.

 @param sampleBuffer The sample buffer from external camera source.
 @note the kCVPixelBufferPixelFormatTypeKey must be specified as kCVPixelFormatType_420YpCbCr8BiPlanarFullRange when setting `AVCaptureVideoDataOutput.videoSettings`.
*/
- (void)sendCameraBuffer:(CMSampleBufferRef)sampleBuffer;
/**
A callback function to be called when external camera device is opened.

@Param isFront Specify if the camera position is front.
*/
- (void)onCameraOpen:(BOOL)isFront;

/**
 Set the current camera kit level.

 Calling this method reapplies the preset thresholds for the selected level.

 @param level The preset camera kit level.
 */
- (void)setCameraKitLevel:(PFCameraKitLevel)level;

/**
 Overwrite the current level thresholds with custom values.

 Calling `-setCameraKitLevel:` again resets the thresholds back to that level's preset values.
 This method accepts a built parameter object.

 @param parameter The parameter values to apply.
 */
- (void)setCameraKitOverwrite:(PFCameraKitParameter *)parameter;

/**
 Unavailable. Use `+createWithModelPath:completion:` for `PFCameraKit` object initializing.
 */
- (id)init __attribute__((unavailable("Use +create")));

/**
 Unavailable. Use `+createWithModelPath:completion` for `PFCameraKit` object initializing.
 */
+ (instancetype)new __attribute__((unavailable("Use +create")));

@end

NS_ASSUME_NONNULL_END
