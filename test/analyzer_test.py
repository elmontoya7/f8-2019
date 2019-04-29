from analyzer import analyze_words
import pytest


def test_negative():
    assert analyze_words.analyze_words("negative") is True


def test_positive():
    assert analyze_words.analyze_words("positive") is True


def test_positive_emoji():
    assert analyze_words.analyze_words("positive_emoji") is True


def test_negative_emoji():
    assert analyze_words.analyze_words("negative_emoji") is True

def test_gun_violence():
    assert analyze_words.analyze_words("gunviolence") is True

def test_gang_violence():
    assert analyze_words.analyze_words("gangviolence") is True
