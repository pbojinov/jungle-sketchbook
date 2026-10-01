"""Rebuild the small feature cache after changing the original animal artwork."""
import numpy as np
from detector import Detector, ROOT
path = ROOT/'scanning/reference-features.npz'
previous = path.with_suffix('.previous')
if path.exists():
    path.rename(previous)
try:
    detector = Detector()
    arrays = {}
    for species, (points, descriptors, _) in detector.references.items():
        arrays[f'{species}_points'] = points
        arrays[f'{species}_descriptors'] = descriptors
    np.savez_compressed(path, **arrays)
    if previous.exists(): previous.unlink()
    print(path)
except Exception:
    if previous.exists(): previous.rename(path)
    raise
