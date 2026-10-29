from pathlib import Path
from html.parser import HTMLParser
import re
from PIL import Image

root = Path(__file__).resolve().parent.parent
class Check(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, attrs['id']
            self.ids.add(attrs['id'])
        for key in ['src', 'href']:
            value = attrs.get(key, '')
            if value.startswith('assets/'):
                # 允许 ?v=... 之类的缓存参数，只检查真实文件路径
                path = value.split('?', 1)[0].split('#', 1)[0]
                assert (root / path).is_file(), value

check = Check()
check.feed((root / 'index.html').read_text(encoding='utf-8'))
for css in (root / 'assets/css').glob('*.css'):
    text = css.read_text(encoding='utf-8')
    for url in re.findall(r'url\([\'"]?([^\)\'\"]+)', text):
        assert (css.parent / url).resolve().is_file(), url
for path in (root / 'assets/images').iterdir():
    with Image.open(path) as image:
        image.verify()
print('HTML IDs, local HTML/CSS asset references and image files OK')
