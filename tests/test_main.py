"""Tests for chrome_tabpage_mgnt."""
import pytest
from chrome_tabpage_mgnt.main import main

def test_main(capsys):
    """Test main function."""
    main()
    captured = capsys.readouterr()
    assert "Hello from chrome_tabpage_mgnt!" in captured.out
