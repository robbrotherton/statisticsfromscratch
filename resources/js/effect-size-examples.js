// Survey responses behind the Chapter 9 effect-size examples: Simmons, Nelson
// and Simonsohn's MTurk sample (N = 697, May 2012), from the data file posted
// with Data Colada [18], "MTurk vs. The Lab: Either Way We Need Big Samples"
// (https://datacolada.org/18). Each group's scores are stored as
// [score, count] pairs. Open-ended answers are trimmed below the 5th and above
// the 95th percentile, as in the authors' own effect-size summary, so the
// means and d values match theirs.
//
// Groups are listed lower-scoring first. `bounds` marks the hard limits of a
// response scale, which the smoothed curves respect; `bandwidth` sets how
// much each curve is smoothed.
(function(global) {
  "use strict";
  global.sfsEffectSizeExamples = {
    height: {
      label: "Height (inches)", unit: "in",
      xDomain: [58,78], bandwidth: 1.2,
      groups: [
        { name: "Women", counts: [[61,19],[61.5,1],[62,37],[63,33],[64,60],[65,41],[66,36],[66.5,1],[67,38],[68,20],[69,13],[70,9],[71,2],[74,1]] },
        { name: "Men", counts: [[61,1],[62,2],[63,5],[64,6],[65,12],[66,18],[67,33],[67.5,1],[68,30],[69,35],[70,53],[71,54],[72,39],[73,25],[74,21]] }
      ]
    },
    socialeq: {
      label: "Importance of social equality (1–7)", unit: "rating",
      xDomain: [1,7], bandwidth: 0.6, bounds: [1,7],
      groups: [
        { name: "Conservatives", counts: [[1,9],[2,7],[3,11],[4,27],[5,50],[6,67],[7,48]] },
        { name: "Liberals", counts: [[1,1],[2,3],[3,5],[4,37],[5,71],[6,123],[7,238]] }
      ]
    },
    eggsalad: {
      label: "How often you eat egg salad (1–7)", unit: "rating",
      xDomain: [1,7], bandwidth: 0.6, bounds: [1,7],
      groups: [
        { name: "Dislike eggs", counts: [[1,52],[2,8],[3,5],[4,2],[7,1]] },
        { name: "Like eggs", counts: [[1,281],[2,116],[3,96],[4,71],[5,50],[6,8],[7,7]] }
      ]
    },
    smoking: {
      label: "Estimated chance a smoker dies of smoking (%)", unit: "%",
      xDomain: [0,100], bandwidth: 6, bounds: [0,100],
      groups: [
        { name: "Smokers", counts: [[20,6],[25,4],[30,11],[33,2],[34,1],[35,1],[40,10],[45,2],[50,38],[55,1],[60,9],[65,7],[70,6],[75,18],[80,8],[85,2],[90,3]] },
        { name: "Nonsmokers", counts: [[15,11],[20,17],[24,1],[25,17],[26,2],[30,21],[33,3],[34,2],[35,7],[38,2],[39,2],[40,23],[45,7],[50,65],[55,4],[56,1],[57,1],[58,1],[60,52],[65,25],[66,3],[67,1],[70,56],[75,70],[76,1],[78,1],[79,2],[80,50],[85,19],[86,3],[87,1],[89,5],[90,29]] }
      ]
    },
    planets: {
      label: "Planets named correctly", unit: "planets",
      xDomain: [3,9], bandwidth: 0.5, bounds: [0,9],
      groups: [
        { name: "Prefer art", counts: [[5,29],[6,28],[7,31],[8,121],[9,81]] },
        { name: "Prefer science", counts: [[5,28],[6,26],[7,40],[8,176],[9,84]] }
      ]
    }
  };
})(window);
