# Pong paddle model

`paddle.blend` is the editable Blender source. `build_paddle.py` recreates it and exports `../../public/models/pong/paddle.glb` using Blender 5.2:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --python assets\pong\build_paddle.py
```

The [2026 ITTF racket rules](https://db.ittf.com/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf) do not prescribe a racket head diameter or handle length. They require a flat, rigid blade and allow sandwich rubber covering thinner than 4.05 mm per side. The model uses the published [Butterfly Primorac blade](https://shop.butterflyonline.com/primorac-fl) as a representative size: 157 × 150 mm head, 5.7 mm blade, and 100 × 25 mm flared handle.

In the Blender script, 1 model unit is approximately 118 mm. The head is 1.33 × 1.27 units, the wooden core is 0.048 units thick, and each rubber side is 0.017 units (about 2 mm). The covered head is about 9.7 mm thick. The visible handle extends about 0.85 units from the head and reaches 0.212 units at its widest point.
