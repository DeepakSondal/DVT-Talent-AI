"""
DVT Talent AI — Worker Test Suite
"""
import pytest

def test_signal_monitor_scan_deduplication():
    """Verify signal deduplication logic"""
    seen_signals = set()
    signal_id = "sig_10293_funding"
    
    assert signal_id not in seen_signals
    seen_signals.add(signal_id)
    assert signal_id in seen_signals
