"""Local OpenCV scanner: coded marks, known-artwork matching, then paper edges."""
import base64
import json
import sys
import time
from pathlib import Path
import cv2
import numpy as np
from registration import (ROOT, SPECIES, PAGE_WIDTH, PAGE_HEIGHT, DICTIONARY, marker_points)

cv2.setNumThreads(2)
PAGE = np.float32([[0, 0], [PAGE_WIDTH-1, 0], [PAGE_WIDTH-1, PAGE_HEIGHT-1], [0, PAGE_HEIGHT-1]])


def polygon_area(points):
    return abs(float(cv2.contourArea(np.float32(points))))


def project_page(photo_to_page, width, height):
    try:
        points = cv2.perspectiveTransform(PAGE[None], np.linalg.inv(photo_to_page))[0]
    except (np.linalg.LinAlgError, cv2.error):
        return None
    normalized = points / np.float32([width, height])
    if not np.isfinite(normalized).all() or (normalized < -.6).any() or (normalized > 1.6).any():
        return None
    if not cv2.isContourConvex(points) or not .08 < polygon_area(points)/(width*height) < 2.8:
        return None
    return normalized.tolist()


class Detector:
    def __init__(self):
        self.sift = cv2.SIFT_create(nfeatures=6500, contrastThreshold=.025)
        self.references = {}
        cache_path = ROOT / 'scanning/reference-features.npz'
        cached = np.load(cache_path, allow_pickle=False) if cache_path.exists() else None
        for species in SPECIES:
            if cached is not None:
                keypoints = cached[f'{species}_points']
                descriptors = cached[f'{species}_descriptors']
            else:
                image = cv2.imread(str(ROOT / f'public/animals/{species}/source-preview.png'), cv2.IMREAD_UNCHANGED)
                image = cv2.resize(image, (PAGE_WIDTH, PAGE_HEIGHT), interpolation=cv2.INTER_AREA)
                image[image[:, :, 3] < 128, :3] = 255
                gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
                keypoints, descriptors = self.sift.detectAndCompute(gray, None)
                keypoints = np.float32([point.pt for point in keypoints])
            bounds = json.loads((ROOT / f'public/animals/{species}/shape.json').read_text())['bounds']
            self.references[species] = (keypoints, descriptors, bounds)
        if cached is not None:
            cached.close()
        params = cv2.aruco.DetectorParameters()
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
        self.markers = cv2.aruco.ArucoDetector(DICTIONARY, params)

    def detect_markers(self, gray):
        corners, ids, _ = self.markers.detectMarkers(gray)
        if ids is None:
            return None
        groups = {}
        for detected, marker_id in zip(corners, ids.flatten()):
            if not 0 <= marker_id < len(SPECIES)*4:
                continue
            species = SPECIES[int(marker_id)//4]
            groups.setdefault(species, {})[int(marker_id)%4] = detected.reshape(4, 2)
        if len(groups) != 1:
            return None
        species, marks = next(iter(groups.items()))
        result = {'species': species, 'identified': True, 'method': 'markers', 'corners': None,
                  'confident': False, 'score': 0, 'markers': len(marks)}
        if len(marks) < 3:
            return result
        source = np.float32([p for points in marks.values() for p in points])
        target = np.float32([p for pos in marks for p in marker_points(pos)])
        homography, mask = cv2.findHomography(source, target, cv2.RANSAC, 2.5)
        if homography is None or mask is None or int(mask.sum()) < 10:
            return result
        residuals = np.linalg.norm(cv2.perspectiveTransform(source[None], homography)[0] - target, axis=1)
        points = project_page(homography, gray.shape[1], gray.shape[0])
        if points is not None and float(np.median(residuals)) < 2:
            result.update(corners=points, confident=True, score=.99 if len(marks) == 4 else .94)
        return result

    def detect_artwork(self, gray, species_hint=None):
        photo_keypoints, photo_descriptors = self.sift.detectAndCompute(gray, None)
        if photo_descriptors is None or len(photo_keypoints) < 12:
            return None
        cv2.setRNGSeed(7)
        matcher = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=80))
        matcher.add([photo_descriptors])
        matcher.train()
        candidates = []
        for species, (keypoints, descriptors, bounds) in self.references.items():
            if species_hint and species != species_hint:
                continue
            matches = [pair[0] for pair in matcher.knnMatch(descriptors, k=2)
                       if len(pair) == 2 and pair[0].distance < .70 * pair[1].distance]
            if len(matches) < 12:
                continue
            source = np.float32([photo_keypoints[m.trainIdx].pt for m in matches])
            target = np.float32([keypoints[m.queryIdx] for m in matches])
            homography, mask = cv2.findHomography(source, target, cv2.USAC_MAGSAC, 3)
            if homography is None or mask is None:
                continue
            good = mask.ravel().astype(bool)
            count = int(good.sum())
            if count < 12:
                continue
            support = target[good]
            coverage = polygon_area(cv2.convexHull(support)) / (bounds['width']*bounds['height'])
            span = np.ptp(support, axis=0) / np.float32([bounds['width'], bounds['height']])
            residuals = np.linalg.norm(cv2.perspectiveTransform(source[good][None], homography)[0]-support, axis=1)
            points = project_page(homography, gray.shape[1], gray.shape[0])
            ratio = count/len(matches)
            stable = (count >= 22 and ratio >= .35 and coverage >= .20 and
                      float(span.min()) >= .45 and float(np.median(residuals)) < 2.3 and points is not None)
            score = min(.98, .55 + min(count,100)*.0025 + min(coverage,.6)*.25) if stable else min(.65,count/60)
            candidates.append({'species': species, 'identified': count >= 22 and ratio >= .35,
                               'method': 'artwork', 'corners': points if stable else None,
                               'confident': stable, 'score': round(score,3), 'inliers': count,
                               'coverage': round(coverage,3)})
        if not candidates:
            return None
        candidates.sort(key=lambda item: item['inliers'], reverse=True)
        best = candidates[0]
        if len(candidates) > 1 and best['inliers'] < candidates[1]['inliers'] * 1.6:
            best.update(identified=False, confident=False, corners=None)
        return best

    def detect_paper(self, gray):
        # Conservative contour fallback; it does not guess which animal is on the page.
        blurred = cv2.GaussianBlur(gray, (5,5), 0)
        edges = cv2.Canny(blurred, 40, 120)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        height, width = gray.shape
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
            polygon = cv2.approxPolyDP(contour, .025*cv2.arcLength(contour, True), True)
            if len(polygon) != 4 or not cv2.isContourConvex(polygon):
                continue
            points = polygon.reshape(4,2).astype(np.float32)
            area = polygon_area(points)/(width*height)
            if not .30 < area < .98:
                continue
            # Order clockwise around the centre, starting at the upper-left corner.
            centre = points.mean(axis=0)
            points = points[np.argsort(np.arctan2(points[:,1]-centre[1], points[:,0]-centre[0]))]
            points = np.roll(points, -np.argmin(points.sum(axis=1)), axis=0)
            top, right, bottom, left = [np.linalg.norm(points[(i+1)%4]-points[i]) for i in range(4)]
            aspect = (top+bottom)/(left+right)
            if not .5 < aspect < 1.05:
                continue
            return {'corners': (points/np.float32([width,height])).tolist(), 'confident': True,
                    'method': 'paper', 'score': .8, 'species': None, 'identified': False}
        return None

    def detect(self, image, species_hint=None):
        if image is None or image.size == 0:
            raise ValueError('Unreadable image')
        height, width = image.shape[:2]
        if min(width,height) < 100:
            return {'species': None, 'identified': False, 'corners': None, 'confident': False, 'method': 'none', 'score': 0}
        if max(width,height) > 2000:
            image = cv2.resize(image, (round(width*2000/max(width,height)), round(height*2000/max(width,height))))
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        marked = self.detect_markers(gray)
        if marked and species_hint and marked['species'] != species_hint:
            marked = None  # A user's explicit animal correction takes precedence.
        if marked and marked['confident'] and (not species_hint or marked['species'] == species_hint):
            return marked
        artwork = self.detect_artwork(gray, species_hint or (marked or {}).get('species'))
        if artwork and artwork['confident']:
            return artwork
        paper = self.detect_paper(gray)
        identified = marked or artwork
        if paper:
            if identified and identified['identified']:
                paper.update(species=identified['species'], identified=True)
            return paper
        if identified and identified['identified']:
            return identified
        return {'species': None, 'identified': False, 'corners': None, 'confident': False, 'method': 'none', 'score': 0}


def worker():
    detector = Detector()
    print(json.dumps({'ready': True}), flush=True)
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            image_data = request['image'].split(',',1)[1]
            pixels = np.frombuffer(base64.b64decode(image_data, validate=True), np.uint8)
            image = cv2.imdecode(pixels, cv2.IMREAD_COLOR)
            started = time.monotonic()
            result = detector.detect(image, request.get('species'))
            result['elapsedMs'] = round((time.monotonic()-started)*1000)
            print(json.dumps({'id': request['id'], 'result': result}), flush=True)
        except Exception as error:
            print(json.dumps({'id': request.get('id'), 'error': str(error)}), flush=True)


if __name__ == '__main__':
    worker()
