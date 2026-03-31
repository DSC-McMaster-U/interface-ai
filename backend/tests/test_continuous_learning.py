from app.continuous_learning import (
    infer_target_domain,
    infer_task_type,
    normalize_agent_memory_entries,
    normalize_user_memory_entries,
)


def test_domain_and_task_inference():
    assert (
        infer_target_domain("go to careers.tesla.com and apply") == "careers.tesla.com"
    )
    assert infer_task_type("search tesla internships") == "search_tesla_internships"


def test_normalize_agent_memory_entries_filters_invalid_items():
    entries = normalize_agent_memory_entries(
        [
            {
                "fact": "Go directly to the internships page instead of broad search.",
                "domain": "tesla.com",
                "target_domain": "tesla.com",
                "task_type": "search_tesla_internships",
                "confidence": 0.9,
            },
            {
                "fact": "Go directly to the internships page instead of broad search.",
                "domain": "tesla.com",
            },
            {"fact": "", "domain": "tesla.com"},
        ]
    )

    assert entries == [
        {
            "fact": "Go directly to the internships page instead of broad search.",
            "domain": "tesla.com",
            "target_domain": "tesla.com",
            "task_type": "search_tesla_internships",
            "confidence": 0.9,
        }
    ]


def test_normalize_user_memory_entries_filters_invalid_items():
    entries = normalize_user_memory_entries(
        [
            {"field_key": "location", "fact": "User's location is California."},
            {"field_key": "location", "fact": "Duplicate should be removed."},
            {"field_key": "", "fact": "Missing field key."},
            {"field_key": "notes", "fact": ""},
        ]
    )

    assert entries == [
        {"field_key": "location", "fact": "User's location is California."}
    ]
