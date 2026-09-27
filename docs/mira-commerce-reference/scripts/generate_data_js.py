#!/usr/bin/env python3
"""Regenerate js/data.generated.js from data/*.json."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def bundle():
    titles = [
        ("لوحة المشروع", "📊"),
        ("الرؤية والنطاق", "🎯"),
        ("خط الأساس والمستودعات", "📦"),
        ("الموجود حاليًا", "✅"),
        ("الخدمات المتوقفة", "⏸️"),
        ("رحلة العميل", "🧍"),
        ("رحلة المتجر والعيادة", "🏪"),
        ("المشاهير والإعلانات", "⭐"),
        ("التصنيفات والفلاتر", "🔎"),
        ("الفيديو والصور", "🎬"),
        ("الطلبات والحجوزات والتواصل", "🧾"),
        ("التحليلات", "📈"),
        ("الصلاحيات والخصوصية والتنظيم", "🔒"),
        ("البنية والتكاملات المقترحة", "🏗️"),
        ("مصفوفة المتطلبات والفجوات", "🗂️"),
        ("المراحل وشروط القبول", "🚦"),
        ("القرارات والأسئلة المفتوحة", "❓"),
        ("مكتبة الأدلة", "📚"),
        ("سجل التغييرات والإصدارات", "📝"),
        ("تحديث المرجع والتحقق", "🔄"),
        ("ملاحظات المراجعة ومعالجتها", "🧾"),
        ("تغطية التكليف والتحقق من اكتماله", "📌"),
        ("ملخص قرار الأماكن", "🧭"),
        ("ما وصل من الأماكن", "📥"),
        ("نتائج مراجعة الحزمة", "🧪"),
        ("معالجة ملاحظات الحزمة", "🛠️"),
        ("مصفوفة إعادة الاستخدام", "🧩"),
        ("تجربة المنتجات", "🛍️"),
        ("تجربة العيادات والمشاغل", "💇"),
        ("معيار الوسائط", "🖼️"),
        ("المشاهدات والإحصاءات", "👁️"),
        ("ربط المتاجر والمشاهير", "🔗"),
        ("خطة تنفيذ الأماكن", "🗺️"),
        ("قرارات أماكن مفتوحة", "❓"),
        ("أدلة حزمة الأماكن", "📦"),
        ("سجل خطة الأماكن", "🗒️"),
        ("التصورات المرجعية", "🎨"),
        ("تصحيح توثيق حزمة المصدر", "📎"),
        ("تفعيل اختبار اكتشفي وخطة الدمج", "🧪"),
        ("مراحل تطوير اكتشفي", "🧭"),
        ("التصميم المعتمد لاكتشفي", "🎨"),
    ]
    return {
        "project": load("project.json"),
        "repositories": load("repositories.json"),
        "capabilities": load("capabilities.json"),
        "pausedServices": load("paused-services.json"),
        "requirements": load("requirements.json"),
        "gaps": load("gaps.json"),
        "decisions": load("decisions.json"),
        "roadmap": load("roadmap.json"),
        "evidence": load("evidence-index.json"),
        "changelog": load("changelog.json"),
        "categories": load("categories.json"),
        "reviewFindings": load("review-findings.json"),
        "scopeCoverage": load("scope-coverage.json"),
        "judgmentCorrections": load("judgment-corrections.json"),
        "contracts": load("contracts.json"),
        "regulatory": load("regulatory.json"),
        "costs": load("costs.json"),
        "mediaLifecycle": load("media-lifecycle.json"),
        "partnerTraces": load("partner-traces.json"),
        "sectionContent": load("section-content.json"),
        "siteAnswers": load("site-answers.json"),
        "scopeDecisions": load("scope-decisions.json"),
        "placesAdoption": load("places-adoption.json"),
        "visualReferences": load("visual-references.json"),
        "sourceCorrections": load("source-handoff-corrections.json"),
        "discoverPlan": load("discover-integration-plan.json"),
        "discoverPhases": load("discover-phases.json"),
        "discoverVisual": load("discover-visual.json"),
        "sections": [
            {"id": f"s{i}", "num": f"{i:02d}", "title": t, "icon": ic}
            for i, (t, ic) in enumerate(titles)
        ],
    }


def main():
    out = ROOT / "js" / "data.generated.js"
    out.write_text(
        "/* Generated from data/*.json — do not edit by hand */\nwindow.MIRA_STUDY = "
        + json.dumps(bundle(), ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print("wrote", out)


if __name__ == "__main__":
    main()
