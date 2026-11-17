import os
from functools import partialmethod
import daft

class dag(daft.PGM):
    def __init__(self, *args, **kwargs):
        daft.PGM.__init__(self, *args, **kwargs)

    obsNode = partialmethod(daft.PGM.add_node, scale=1.5, aspect=2.6, fontsize=11,
                            plot_params={"facecolor": "aliceblue"})

X = "X\n(the choice)"
Z = "Z\n(third variable)"
Y = "Y\n(the outcome)"
MAYBE = {"ec": "gray", "fc": "gray"}

def draw(name, nodes, edges):
    pgm = dag(dpi=150)
    for key, label, x, y in nodes:
        pgm.obsNode(key, label, x, y)
    for a, b, *style in edges:
        pgm.add_edge(a, b, plot_params=style[0] if style else {})
    pgm.render()
    pgm.savefig(f"public/images/causality/{name}.png", dpi=300, facecolor="white")
    print(f"saved public/images/causality/{name}.png")

os.makedirs("public/images/causality", exist_ok=True)

# Fork: Z is a common cause. The gray arrow is "maybe": X may or may not
# also affect Y directly, and stratifying by Z is how you find out.
draw("fork",
     [("z", Z, 3.1, 2.4), ("x", X, 0.9, 0.8), ("y", Y, 5.3, 0.8)],
     [("z", "x"), ("z", "y"), ("x", "y", MAYBE)])
# Pipe: Z is how X works.
draw("pipe",
     [("x", X, 0.9, 1.5), ("z", Z, 3.4, 1.5), ("y", Y, 5.9, 1.5)],
     [("x", "z"), ("z", "y")])
# Collider: Z is a common effect of X and Y.
draw("collider",
     [("x", X, 0.9, 2.4), ("y", Y, 5.3, 2.4), ("z", Z, 3.1, 0.8)],
     [("x", "z"), ("y", "z")])
# Direct: X affects Y, and Z is a bystander with no arrows.
draw("direct",
     [("x", X, 0.9, 0.8), ("y", Y, 5.3, 0.8), ("z", Z, 3.1, 2.4)],
     [("x", "y")])