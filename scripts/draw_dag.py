import os
from functools import partialmethod
import daft

class dag(daft.PGM):
    def __init__(self, *args, **kwargs):
        daft.PGM.__init__(self, *args, **kwargs)

    latNode = partialmethod(daft.PGM.add_node, scale=1.3, aspect=2.4,
                            fontsize=10, plot_params={"facecolor": "aliceblue"})
    detNode = partialmethod(daft.PGM.add_node, aspect=5.4, fontsize=9.25,
                            alternate=True, plot_params={"facecolor": "aliceblue"})
    decNode = partialmethod(daft.PGM.add_node, scale=1.3, aspect=2.4, fontsize=10,
                            shape="rectangle", plot_params={"facecolor": "lightyellow"})

pgm = dag(dpi=150, alternate_style="outer")
pgm.detNode("w0", "Initial Wealth\n" + r"$W_0$ = buy-in", 1.0, 2.6,
            scale=1.5, aspect=3.4)
pgm.decNode("f", "Stake Fraction $f$\n(decision: one of the candidates)", 5.6, 2.6,
            scale=1.5, aspect=4.4)
pgm.latNode("coin", "Coin Flip in Year $t$\n" + r"$C_t \sim Bernoulli(0.5)$",
            0.6, 1, scale=1.6, aspect=3.8)
pgm.detNode("wt", "Wealth after Year $t$\n"
            + r"$W_t = W_{t-1}(1 + u f)$ if $C_t{=}1$, $W_{t-1}(1 - d f)$ if $C_t{=}0$",
            4.9, 1, scale=1.6, aspect=6.4)
pgm.add_edge("w0", "wt")
pgm.add_edge("f", "wt")
pgm.add_edge("coin", "wt")
pgm.add_plate([-1.5, 0.35, 9.4, 1.3], label=r"$t = 1, \ldots, N$", shift=-0.1)
pgm.render()

os.makedirs("public/images", exist_ok=True)
pgm.savefig("public/images/dag.png", dpi=300, facecolor="white")
print("saved public/images/dag.png")