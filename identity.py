from __future__ import annotations

import re
from dataclasses import dataclass


_UNASSIGNED = {"", "unassigned", "unknown", "none", "n/a", "na"}


def normalize_person_name(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"<@([A-Z0-9]+)>", r"\1", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def split_people(value: str | None) -> list[str]:
    if not value:
        return []
    text = re.sub(r"\s+and\s+", ",", value.replace("&", ","), flags=re.IGNORECASE)
    return [part.strip() for part in text.split(",") if part.strip()]


@dataclass(frozen=True)
class PersonIdentity:
    id: str
    name: str


class SlackIdentityIndex:
    def __init__(self, people: list[PersonIdentity]):
        self._by_id: dict[str, PersonIdentity] = {}
        self._by_alias: dict[str, PersonIdentity | None] = {}

        for person in people:
            if not person.id or not person.name:
                continue
            self._by_id[person.id] = person

        alias_to_people: dict[str, set[str]] = {}
        for person in self._by_id.values():
            for alias in self._aliases_for(person):
                alias_to_people.setdefault(alias, set()).add(person.id)

        for alias, ids in alias_to_people.items():
            self._by_alias[alias] = self._by_id[next(iter(ids))] if len(ids) == 1 else None

    @classmethod
    def from_channel_data(cls, channel_data: dict[str, list[dict]]) -> "SlackIdentityIndex":
        people: dict[str, PersonIdentity] = {}
        for messages in channel_data.values():
            for msg in messages:
                cls._collect_message_person(msg, people)
                for reply in msg.get("replies", []):
                    cls._collect_message_person(reply, people)
        return cls(list(people.values()))

    @staticmethod
    def _collect_message_person(msg: dict, people: dict[str, PersonIdentity]) -> None:
        user_id = str(msg.get("user_id") or "").strip()
        name = str(msg.get("user") or "").strip()
        if user_id and name and user_id not in people:
            people[user_id] = PersonIdentity(id=user_id, name=name)

    @staticmethod
    def _aliases_for(person: PersonIdentity) -> set[str]:
        aliases = {normalize_person_name(person.id), normalize_person_name(person.name)}
        parts = normalize_person_name(person.name).split()
        if parts:
            aliases.add(parts[0])
        return {a for a in aliases if a}

    def resolve_one(self, value: str | None) -> PersonIdentity | None:
        raw = (value or "").strip()
        if normalize_person_name(raw) in _UNASSIGNED:
            return None

        mention = re.search(r"<@([A-Z0-9]+)>", raw)
        if mention:
            return self._by_id.get(mention.group(1))
        if raw in self._by_id:
            return self._by_id[raw]

        return self._by_alias.get(normalize_person_name(raw))

    def resolve_many(self, value: str | None) -> list[PersonIdentity]:
        resolved: list[PersonIdentity] = []
        seen: set[str] = set()
        for person_text in split_people(value):
            person = self.resolve_one(person_text)
            if person and person.id not in seen:
                resolved.append(person)
                seen.add(person.id)
        return resolved

    def canonicalize_many(self, value: str | None) -> tuple[str, str]:
        people = self.resolve_many(value)
        if not people:
            return ((value or "unassigned").strip() or "unassigned", "")
        return (
            ", ".join(person.name for person in people),
            ",".join(person.id for person in people),
        )
