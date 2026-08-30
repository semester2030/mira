# Backward Compatibility Matrix

| Client | Behavior |
|---|---|
| Current Flutter | omits publicFactAr/reasonAr on wire |
| Old Flutter sending free text | DTO accepts; sanitize+projector ignore |
| Server without client cleanup | still safe |
