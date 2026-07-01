import { GarmentRecolorPromptService } from './garment-recolor-prompt.service';

describe('GarmentRecolorPromptService', () => {
  const service = new GarmentRecolorPromptService();

  it('builds v2 Arabic prompt with garment and color', () => {
    const result = service.build({
      targetColorAr: 'أسود',
      garmentLabelAr: 'فستان',
    });

    expect(result.promptAr).toContain('فستان');
    expect(result.promptAr).toContain('أسود');
    expect(result.promptAr).toContain('#1A1A1A');
    expect(result.promptAr).toContain('المحظور');
    expect(result.promptAr).toContain('الخامة');
    expect(result.promptAr).toContain('الهندسة');
    expect(result.userMessageAr).toContain('فستان');
    expect(result.garmentLabelAr).toBe('فستان');
  });

  it('includes vision context geometry and material hints', () => {
    const result = service.build({
      targetColorAr: 'كحلي',
      garmentLabelAr: 'بلوزة',
      visionContext: {
        regionRole: 'upper',
        fit: 'oversized',
        foldDensity: 'high',
        glossLevel: 'matte',
        material: 'cotton',
        materialConfidence: 0.72,
      },
    });

    expect(result.promptAr).toContain('upper');
    expect(result.promptAr).toContain('oversized');
    expect(result.promptAr).toContain('عالية');
    expect(result.promptAr).toContain('قطن');
    expect(result.promptAr).toContain('مطفياً');
  });

  it('defaults garment label when omitted', () => {
    const result = service.build({ targetColorAr: 'ذهبي' });
    expect(result.garmentLabelAr).toBe('القطعة العلوية');
    expect(result.targetColorHex).toBe('#C8A850');
  });

  it('respects explicit hex override', () => {
    const result = service.build({
      targetColorAr: 'أزرق',
      targetColorHex: '#0044AA',
    });
    expect(result.targetColorHex).toBe('#0044AA');
    expect(result.promptAr).toContain('#0044AA');
  });

  it('uses custom prompt when provided', () => {
    const custom = 'برومبت مخصص من التطبيق';
    const result = service.build({
      targetColorAr: 'أسود',
      garmentLabelAr: 'فستان',
      customPromptAr: custom,
    });
    expect(result.promptAr).toBe(custom);
  });

  it('appends strict retry suffix on QEL retry', () => {
    const suffix = GarmentRecolorPromptService.strictRetrySuffix(2);
    const result = service.build({
      targetColorAr: 'أسود',
      garmentLabelAr: 'فستان',
      strictSuffixAr: suffix,
    });
    expect(result.promptAr).toContain(suffix);
    expect(suffix).toContain('تشديد');
  });
});
