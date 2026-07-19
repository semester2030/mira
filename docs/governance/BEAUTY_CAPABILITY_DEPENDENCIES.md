# Beauty Capability Dependencies

**Version:** `beauty-cap-deps-v1`  
**Law #15:** Dependencies are explicit — never inferred.

## Example: Hair Color

```
hair_color
  → hair_mask
  → face_alignment
  → capture_quality
  → capability_policy
  → provider_manager
  → beauty_session
  → user_consent
```

## System dependencies (common)

- `capability_policy`  
- `provider_manager`  
- `beauty_session`  
- `user_consent`  
- `subscription_entitlement` (future wiring)  

## Asset dependencies

| Capability | Primary assets |
|------------|----------------|
| lip | lip_mask, portrait_image, capture_quality |
| foundation / blush / eyeshadow / contour | face_mask, … |
| hair_* | hair_mask, … |
| glasses | face_mesh, … |
| look | face_mask + may depend on `lip`, `foundation` |

Graph builder: `buildCapabilityDependencyGraph()` in API.
