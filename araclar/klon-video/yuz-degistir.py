"""FaceFusion'ı Windows'ta ekran kartıyla (CUDA) çalıştıran başlatıcı.

Neden: onnxruntime-gpu CUDA kütüphanelerini kendisi yüklemezse SESSİZCE işlemciye düşer (kare başına 20 kat yavaş).
`onnxruntime.preload_dlls()` bunu önler. Kullanım (FaceFusion klasöründe, kendi .venv'inin python'uyla):

  python yuz-degistir.py headless-run --source-paths yuz1.jpg yuz2.jpg --target-path hedef.mp4 --output-path cikti.mp4       --processors face_swapper --execution-providers cuda --execution-thread-count 2 --face-swapper-model hyperswap_1a_256

- face_enhancer KAPALI tut (0,1 sn/kare; açıkken 2 sn/kare ve ekran kartı belleği dolar).
- SADECE kendi yüzün ya da yazılı izin verilen yüz için; yayında "yapay/değiştirilmiş içerik" kutusunu işaretle.
"""
import runpy
import sys

import onnxruntime

onnxruntime.preload_dlls(directory="")
sys.argv[0] = "facefusion.py"
runpy.run_path("facefusion.py", run_name="__main__")
