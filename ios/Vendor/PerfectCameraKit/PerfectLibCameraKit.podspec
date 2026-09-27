Pod::Spec.new do |s|
  s.name             = 'PerfectLibCameraKit'
  s.version          = '2.5.0'
  s.summary          = 'Perfect Corp Mobile CameraKit 2.5.0 for MIRA Skin capture quality'
  s.homepage         = 'https://www.perfectcorp.com'
  s.license          = { :type => 'Commercial', :text => 'Perfect Corp proprietary SDK' }
  s.author           = { 'Perfect Corp' => 'https://www.perfectcorp.com' }
  s.platform         = :ios, '12.0'
  s.source           = { :path => '.' }
  s.vendored_frameworks = 'PerfectLibCameraKit.xcframework'
  s.frameworks       = 'AVFoundation', 'CoreMotion', 'CoreMedia', 'CoreVideo', 'UIKit', 'Foundation'
  s.libraries        = 'c++'
  s.pod_target_xcconfig = {
    'OTHER_LDFLAGS' => '-ObjC',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
  s.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '-ObjC'
  }
  s.resource_bundles = {
    'PerfectCameraKitModels' => ['model/*']
  }
end
